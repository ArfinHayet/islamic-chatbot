/**
 * Hadith Seeder
 *
 * Reads the locally converted multilingual-hadith/hadiths.jsonl dataset,
 * generates Gemini embeddings (Arabic + English text concatenated), and stores
 * each hadith with its embedding in the hadith_entries PostgreSQL table.
 *
 * Dataset location: multilingual-hadith/hadiths.jsonl
 * Generate it first with: npx ts-node -r tsconfig-paths/register src/scripts/convert-hadith.ts
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-hadith.ts
 *
 * Requires DATABASE_URL and GEMINI_API_KEY environment variables.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RagService, HadithRaw } from '../rag/rag.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const LOCAL_JSONL_PATH = path.resolve(__dirname, '../../multilingual-hadith/hadiths.jsonl');

const LOG_EVERY = 100;
const INTER_REQUEST_MS = 1200; // ~50 req/min, well under free tier limit
const MAX_RETRIES = 6;

const logger = new Logger('SeedHadith');

function buildEmbeddingText(h: HadithRaw): string {
  return [h.text_ar, h.text_en].filter(Boolean).join(' | ');
}

function readLocalJsonl(filePath: string): Promise<HadithRaw[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Dataset file not found: ${filePath}`));
      return;
    }

    logger.log(`Reading dataset from ${filePath} ...`);
    const records: HadithRaw[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as HadithRaw);
      } catch {
        logger.warn(`Skipping malformed JSONL line: ${trimmed.slice(0, 80)}`);
      }
    });

    rl.on('close', () => {
      logger.log(`Loaded ${records.length} hadith records from local file`);
      resolve(records);
    });

    rl.on('error', reject);
  });
}

async function embedWithRetry(
  embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  text: string,
): Promise<number[]> {
  let delay = 10_000;
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
        logger.warn(
          `Rate limited, waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES} ...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 120_000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

async function processHadith(
  h: HadithRaw,
  ragService: RagService,
  embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<{ success: number; skipped: number }> {
  try {
    const embeddingText = buildEmbeddingText(h);
    if (!embeddingText.trim()) {
      logger.warn(`Skipping hadith ${h.id}: no text to embed`);
      return { success: 0, skipped: 1 };
    }
    const embedding = await embedWithRetry(embeddingModel, embeddingText);
    await ragService.saveHadithEntry(h, embedding);
    return { success: 1, skipped: 0 };
  } catch (err) {
    logger.warn(`Skipping hadith ${h.id}: ${(err as Error).message}`);
    return { success: 0, skipped: 1 };
  }
}

async function main(): Promise<void> {
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

  let hadiths: HadithRaw[];
  try {
    hadiths = await readLocalJsonl(LOCAL_JSONL_PATH);
  } catch (err) {
    logger.error(`Failed to read dataset: ${(err as Error).message}`);
    await app.close();
    process.exit(1);
  }

  const seededIds = await ragService.getSeededHadithIds();
  const pending = hadiths.filter((h) => !seededIds.has(h.id));
  logger.log(
    `Already seeded: ${seededIds.size} | Remaining: ${pending.length} | Total: ${hadiths.length}`,
  );

  if (pending.length === 0) {
    logger.log('All hadiths already seeded. Nothing to do.');
    await app.close();
    process.exit(0);
  }

  logger.log(
    `Starting seeding of ${pending.length} hadiths (sequential, ~${INTER_REQUEST_MS}ms/hadith) ...`,
  );

  let totalSuccess = 0;
  let totalSkipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const { success, skipped } = await processHadith(pending[i], ragService, embeddingModel);
    totalSuccess += success;
    totalSkipped += skipped;

    if ((i + 1) % LOG_EVERY === 0 || i + 1 === pending.length) {
      logger.log(
        `Progress: ${i + 1}/${pending.length} hadiths processed ` +
          `(success=${totalSuccess}, skipped=${totalSkipped})`,
      );
    }

    if (i + 1 < pending.length) {
      await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
    }
  }

  logger.log(`Seeding complete. Success=${totalSuccess}, Skipped=${totalSkipped}`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`Fatal error: ${(err as Error).message}`, (err as Error).stack);
  process.exit(1);
});
