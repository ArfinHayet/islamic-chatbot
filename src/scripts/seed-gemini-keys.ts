/**
 * Seed Gemini API Keys
 *
 * Reads gemini-keys.json, encrypts each key with PRIVATE_KEY, and stores
 * them in the gemini_keys table. Safe to re-run — all keys are inserted fresh.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-gemini-keys.ts
 *
 * Requires: DATABASE_URL and PRIVATE_KEY in .env
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../app.module';
import { GeminiKeyService } from '../rag/services/gemini-key.service';

const KEYS_FILE = path.resolve(__dirname, '../../gemini-keys.json');
const logger = new Logger('SeedGeminiKeys');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const keyService = app.get(GeminiKeyService);

  if (!fs.existsSync(KEYS_FILE)) {
    logger.error(`File not found: ${KEYS_FILE}`);
    await app.close();
    process.exit(1);
  }

  let keys: unknown;
  try {
    keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
  } catch (err) {
    logger.error(`Failed to parse gemini-keys.json: ${(err as Error).message}`);
    await app.close();
    process.exit(1);
  }

  if (!Array.isArray(keys)) {
    logger.error('gemini-keys.json must be a JSON array of strings');
    await app.close();
    process.exit(1);
  }

  const validKeys = (keys as unknown[]).filter(
    (k): k is string => typeof k === 'string' && k.trim().length > 0,
  );

  logger.log(`Found ${validKeys.length} keys in gemini-keys.json`);

  let saved = 0;
  let failed = 0;

  for (const apiKey of validKeys) {
    try {
      await keyService.saveKey(apiKey);
      saved++;
    } catch (err) {
      logger.warn(`Failed to save key …${apiKey.slice(-6)}: ${(err as Error).message}`);
      failed++;
    }
  }

  logger.log(`Done — saved: ${saved} | failed: ${failed}`);

  const stats = await keyService.getStats();
  logger.log(`DB stats: ${JSON.stringify(stats)}`);

  await app.close();
  process.exit(failed === validKeys.length ? 1 : 0);
}

main().catch((err: Error) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
