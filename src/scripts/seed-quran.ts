/**
 * Quran Verse Seeder
 *
 * Reads the locally downloaded multilingual Quran dataset, generates Gemini embeddings
 * (all 9 language translations concatenated for cross-lingual semantic search), and stores
 * each verse with its embedding in the local quran_verses PostgreSQL table.
 *
 * Dataset location: multilingual-quran/multilingual_quran.jsonl
 * (relative to project root, i.e. d:\maestro\islamic-chatbot)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-quran.ts
 *
 * Set env vars first (DATABASE_URL, GEMINI_API_KEY, etc.) — same as the main app.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RagService, QuranVerseRaw } from '../rag/rag.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Path to the manually downloaded dataset (relative to project root)
const LOCAL_JSONL_PATH = path.resolve(__dirname, '../../multilingual-quran/multilingual_quran.jsonl');

const BATCH_SIZE = 1;     // sequential — one verse at a time to stay under rate limit
const LOG_EVERY = 50;     // log progress every N verses
const INTER_REQUEST_MS = 1200;  // ~50 requests/min, well under free tier limit
const MAX_RETRIES = 6;    // max retries per verse on 429

const logger = new Logger('SeedQuran');

// Raw shape from the HuggingFace dataset (uses verse_* field names)
interface RawVerseRecord {
  id: string;
  chapter_number: number;
  chapter_name: string;
  verse_number: number;
  chapter_type: string;
  total_verses: number;
  verse_ar: string;
  verse_bn?: string;
  verse_en?: string;
  verse_es?: string;
  verse_fr?: string;
  verse_id?: string;
  verse_ru?: string;
  verse_tr?: string;
  verse_zh?: string;
}

function buildEmbeddingText(v: RawVerseRecord): string {
  // Concatenate all 9 translations for maximum cross-lingual recall
  return [
    v.verse_ar,
    v.verse_en,
    v.verse_fr,
    v.verse_es,
    v.verse_id,
    v.verse_ru,
    v.verse_tr,
    v.verse_bn,
    v.verse_zh,
  ]
    .filter(Boolean)
    .join(' | ');
}

function readLocalJsonl(filePath: string): Promise<RawVerseRecord[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Dataset file not found: ${filePath}`));
      return;
    }

    logger.log(`Reading dataset from ${filePath} ...`);
    const records: RawVerseRecord[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as RawVerseRecord);
      } catch {
        logger.warn(`Skipping malformed JSONL line: ${trimmed.slice(0, 80)}`);
      }
    });

    rl.on('close', () => {
      logger.log(`Loaded ${records.length} verse records from local file`);
      resolve(records);
    });

    rl.on('error', reject);
  });
}

async function embedWithRetry(
  embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  text: string,
): Promise<number[]> {
  let delay = 10_000; // start with 10s on first 429
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text }], role: 'user' },
        outputDimensionality: 768,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return result.embedding.values;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const is429 = msg.includes('429') || msg.toLowerCase().includes('too many requests');
      if (is429 && attempt < MAX_RETRIES) {
        logger.warn(`Rate limited, waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES} ...`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 120_000); // cap at 2 minutes
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

async function processVerse(
  v: RawVerseRecord,
  ragService: RagService,
  embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<{ success: number; skipped: number }> {
  try {
    const embeddingText = buildEmbeddingText(v);
    const embedding = await embedWithRetry(embeddingModel, embeddingText);

    // Map dataset field names (verse_*) → DB column names (text_*)
    const verseRaw: QuranVerseRaw = {
      id: v.id,
      chapter_number: v.chapter_number,
      chapter_name: v.chapter_name,
      verse_number: v.verse_number,
      chapter_type: v.chapter_type,
      total_verses: v.total_verses,
      text_ar: v.verse_ar,
      text_bn: v.verse_bn ?? null,
      text_en: v.verse_en ?? null,
      text_es: v.verse_es ?? null,
      text_fr: v.verse_fr ?? null,
      text_id: v.verse_id ?? null,
      text_ru: v.verse_ru ?? null,
      text_tr: v.verse_tr ?? null,
      text_zh: v.verse_zh ?? null,
    };

    await ragService.saveQuranVerse(verseRaw, embedding);
    return { success: 1, skipped: 0 };
  } catch (err) {
    logger.warn(`Skipping verse ${v.id}: ${(err as Error).message}`);
    return { success: 0, skipped: 1 };
  }
}

async function main(): Promise<void> {
  // Bootstrap NestJS app context (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ragService = app.get(RagService);
  const configService = app.get(ConfigService);

  const apiKey = configService.get<string>('gemini.apiKey') as string;
  const modelName =
    configService.get<string>('gemini.embeddingModel') ?? 'gemini-embedding-001';
  const genAI = new GoogleGenerativeAI(apiKey);
  const embeddingModel = genAI.getGenerativeModel({ model: modelName });

  let verses: RawVerseRecord[];
  try {
    verses = await readLocalJsonl(LOCAL_JSONL_PATH);
  } catch (err) {
    logger.error(`Failed to read dataset: ${(err as Error).message}`);
    await app.close();
    process.exit(1);
  }

  const seededIds = await ragService.getSeededVerseIds();
  const pending = verses.filter((v) => !seededIds.has(v.id));
  logger.log(
    `Already seeded: ${seededIds.size} | Remaining: ${pending.length} | Total: ${verses.length}`,
  );

  if (pending.length === 0) {
    logger.log('All verses already seeded. Nothing to do.');
    await app.close();
    process.exit(0);
  }

  logger.log(`Starting seeding of ${pending.length} verses (sequential, ~${INTER_REQUEST_MS}ms/verse) ...`);

  let totalSuccess = 0;
  let totalSkipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const { success, skipped } = await processVerse(pending[i], ragService, embeddingModel);
    totalSuccess += success;
    totalSkipped += skipped;

    if ((i + 1) % LOG_EVERY === 0 || i + 1 === pending.length) {
      logger.log(
        `Progress: ${i + 1}/${pending.length} verses processed ` +
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
