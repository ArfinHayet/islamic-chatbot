/**
 * Quran Tafsir Seeder
 *
 * Reads the local Ibn Kathir Quran Tafsir dataset, generates Gemini embeddings
 * (formatted as "Surah {chapter_number} Ayah {verse_number} Tafsir: {text_plain}"),
 * and stores each tafsir with its embedding in the local quran_tafsirs PostgreSQL table.
 *
 * Dataset location: ../kaggle-quran-tafsir/data/quran/surah_*.jsonl
 * (relative to project root, i.e. /Users/arfinhayet/Desktop/projects/NoorAi/islamic-chatbot)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-tafsir.ts
 *
 * Set env vars first (DATABASE_URL, GEMINI_API_KEY, etc.) — same as the main app.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RagService, QuranTafsirRaw } from '../rag/rag.service';
import { GeminiKeyService } from '../rag/services/gemini-key.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const TAFSIR_DIR = path.resolve(__dirname, '../../../kaggle-quran-tafsir/data/quran');

const BATCH_SIZE = 1;     // sequential — one tafsir at a time to stay under rate limit
const LOG_EVERY = 50;     // log progress every N verses
const INTER_REQUEST_MS = 1200;  // ~50 requests/min, well under free tier limit
const MAX_RETRIES = 6;    // max retries per verse on 429

const logger = new Logger('SeedTafsir');

interface RawTafsirRecord {
  surah: number;
  ayah: number;
  verse_key: string;
  text_html: string;
  text_plain: string | null;
}

function buildEmbeddingText(t: RawTafsirRecord): string {
  // Pattern requested by user: Surah {chapter_number} Ayah {verse_number} Tafsir: {text_plain}
  const plainText = t.text_plain || t.text_html.replace(/<[^>]+>/g, '') || '';
  return `Surah ${t.surah} Ayah ${t.ayah} Tafsir: ${plainText}`;
}

function readJsonlFile(filePath: string): Promise<RawTafsirRecord[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Dataset file not found: ${filePath}`));
      return;
    }

    const records: RawTafsirRecord[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as RawTafsirRecord);
      } catch {
        logger.warn(`Skipping malformed JSONL line in ${path.basename(filePath)}`);
      }
    });

    rl.on('close', () => {
      resolve(records);
    });

    rl.on('error', reject);
  });
}

function isRateLimitError(err: unknown): boolean {
  const msg = ((err as Error).message ?? '').toLowerCase();
  return msg.includes('429') || msg.includes('quota') || msg.includes('too many requests');
}

/**
 * Embeds text using dynamic key rotation:
 * 1. Tries each active DB key in round-robin order, marking rate-limited ones.
 * 2. Falls back to the .env GEMINI_API_KEY with exponential backoff once all DB keys are spent.
 */
async function embedWithRotation(
  keyService: GeminiKeyService,
  fallbackApiKey: string,
  modelName: string,
  text: string,
): Promise<number[]> {
  const tried = new Set<string>();

  // --- Try DB keys ---
  while (true) {
    const keyData = await keyService.getNextKey();
    if (!keyData || tried.has(keyData.id)) break;
    tried.add(keyData.id);
    try {
      const result = await new GoogleGenerativeAI(keyData.apiKey)
        .getGenerativeModel({ model: modelName })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .embedContent({ content: { parts: [{ text }], role: 'user' }, outputDimensionality: 768 } as any);
      return result.embedding.values;
    } catch (err) {
      if (isRateLimitError(err)) {
        logger.warn(`DB key ${keyData.id.slice(0, 8)}… rate-limited, rotating to next key...`);
        await keyService.markRateLimited(keyData.id);
        continue;
      }
      throw err;
    }
  }

  // --- Fallback: .env key with exponential backoff ---
  logger.warn('All DB keys exhausted, falling back to .env GEMINI_API_KEY with backoff...');
  const fallbackModel = new GoogleGenerativeAI(fallbackApiKey).getGenerativeModel({ model: modelName });
  let delay = 10_000;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fallbackModel.embedContent({ content: { parts: [{ text }], role: 'user' }, outputDimensionality: 768 } as any);
      return result.embedding.values;
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        logger.warn(`Fallback key rate-limited, waiting ${delay / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 120_000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded on fallback key');
}

async function processTafsir(
  t: RawTafsirRecord,
  ragService: RagService,
  keyService: GeminiKeyService,
  fallbackApiKey: string,
  modelName: string,
): Promise<{ success: number; skipped: number }> {
  try {
    const embeddingText = buildEmbeddingText(t);
    const embedding = await embedWithRotation(keyService, fallbackApiKey, modelName, embeddingText);

    const tafsirRaw: QuranTafsirRaw = {
      id: `${t.surah}:${t.ayah}`,
      chapter_number: t.surah,
      verse_number: t.ayah,
      verse_key: t.verse_key,
      text_html: t.text_html,
      text_plain: t.text_plain,
    };

    await ragService.saveQuranTafsir(tafsirRaw, embedding);
    return { success: 1, skipped: 0 };
  } catch (err) {
    logger.warn(`Skipping tafsir ${t.surah}:${t.ayah}: ${(err as Error).message}`);
    return { success: 0, skipped: 1 };
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(TAFSIR_DIR)) {
    logger.error(`Dataset directory not found: ${TAFSIR_DIR}`);
    process.exit(1);
  }

  // Bootstrap NestJS app context (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ragService = app.get(RagService);
  const configService = app.get(ConfigService);
  const keyService = app.get(GeminiKeyService);

  const fallbackApiKey = configService.get<string>('gemini.apiKey') as string;
  const modelName =
    configService.get<string>('gemini.embeddingModel') ?? 'gemini-embedding-001';

  const stats = await keyService.getStats();
  logger.log(`DB key stats: ${JSON.stringify(stats)}`);

  // Read all surah JSONL files
  logger.log(`Scanning tafsir directory: ${TAFSIR_DIR} ...`);
  const files = fs.readdirSync(TAFSIR_DIR)
    .filter((f) => f.startsWith('surah_') && f.endsWith('.jsonl'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('surah_', '').replace('.jsonl', ''), 10);
      const numB = parseInt(b.replace('surah_', '').replace('.jsonl', ''), 10);
      return numA - numB;
    });

  logger.log(`Found ${files.length} Surah JSONL files.`);

  // Load all records from files
  let allRecords: RawTafsirRecord[] = [];
  for (const file of files) {
    const filePath = path.join(TAFSIR_DIR, file);
    try {
      const records = await readJsonlFile(filePath);
      allRecords = allRecords.concat(records);
    } catch (err) {
      logger.error(`Failed to read file ${file}: ${(err as Error).message}`);
    }
  }

  logger.log(`Loaded ${allRecords.length} total tafsir records from files.`);

  // Get already seeded IDs
  const seededIds = await ragService.getSeededTafsirIds();
  const pending = allRecords.filter((t) => !seededIds.has(`${t.surah}:${t.ayah}`));

  logger.log(
    `Already seeded: ${seededIds.size} | Remaining: ${pending.length} | Total: ${allRecords.length}`,
  );

  if (pending.length === 0) {
    logger.log('All tafsirs already seeded. Nothing to do.');
    await app.close();
    process.exit(0);
  }

  logger.log(`Starting seeding of ${pending.length} tafsirs (sequential, ~${INTER_REQUEST_MS}ms/tafsir) ...`);

  let totalSuccess = 0;
  let totalSkipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const { success, skipped } = await processTafsir(pending[i], ragService, keyService, fallbackApiKey, modelName);
    totalSuccess += success;
    totalSkipped += skipped;

    if ((i + 1) % LOG_EVERY === 0 || i + 1 === pending.length) {
      logger.log(
        `Progress: ${i + 1}/${pending.length} tafsirs processed ` +
          `(success=${totalSuccess}, skipped=${totalSkipped})`,
      );
    }

    // Throttle to stay under Gemini free-tier rate limit
    if (i + 1 < pending.length) {
      await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
    }
  }

  logger.log(
    `Seeding complete. Pending: ${pending.length} | Success: ${totalSuccess} | Skipped: ${totalSkipped}`,
  );

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Seeder crashed: ${(err as Error).message}`, (err as Error).stack);
  process.exit(1);
});
