import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GeminiKeyEntity } from '../entities/gemini-key.entity';
import { CryptoService } from '../../common/services/crypto.service';

export interface KeyWithId {
  id: string;
  apiKey: string;
}

@Injectable()
export class GeminiKeyService implements OnModuleInit {
  private readonly logger = new Logger(GeminiKeyService.name);

  constructor(
    @InjectRepository(GeminiKeyEntity)
    private readonly repo: Repository<GeminiKeyEntity>,
    private readonly crypto: CryptoService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS gemini_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "encryptedKey" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        "failureCount" INTEGER NOT NULL DEFAULT 0,
        "lastUsedAt" TIMESTAMPTZ,
        "rateLimitedUntil" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.logger.log('Gemini keys table ensured');
  }

  /**
   * Returns the next available decrypted key and its DB id for tracking.
   * Automatically reactivates any keys whose rate-limit window (end of day) has passed.
   * Returns null when all keys are rate-limited or inactive.
   */
  async getNextKey(): Promise<KeyWithId | null> {
    // Reactivate keys whose day-wise limit window has expired
    await this.dataSource.query(`
      UPDATE gemini_keys
      SET status = 'active', "rateLimitedUntil" = NULL, "updatedAt" = NOW()
      WHERE status = 'rate_limited'
        AND "rateLimitedUntil" IS NOT NULL
        AND "rateLimitedUntil" < NOW()
    `);

    // Round-robin: pick least-recently-used active key
    const key = await this.repo.findOne({
      where: { status: 'active' },
      order: { lastUsedAt: 'ASC' },
    });

    if (!key) return null;

    await this.repo.update(key.id, { lastUsedAt: new Date() });

    return { id: key.id, apiKey: this.crypto.decrypt(key.encryptedKey) };
  }

  /**
   * Mark a key (by its DB id) as rate-limited until end of the current day.
   * This reflects Gemini's free-tier daily quota reset.
   */
  async markRateLimited(keyId: string): Promise<void> {
    const now = new Date();
    // End of today in UTC
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
    );

    await this.repo.update(keyId, {
      status: 'rate_limited',
      rateLimitedUntil: endOfToday,
      updatedAt: new Date(),
    });
    // Increment failureCount via raw SQL to avoid type issues
    await this.dataSource.query(
      `UPDATE gemini_keys SET "failureCount" = "failureCount" + 1 WHERE id = $1`,
      [keyId],
    );

    this.logger.warn(`Key ${keyId.slice(0, 8)}… rate-limited until ${endOfToday.toISOString()}`);
  }

  /** Encrypt and persist a new API key */
  async saveKey(apiKey: string): Promise<void> {
    await this.repo.insert({
      encryptedKey: this.crypto.encrypt(apiKey),
      status: 'active',
      failureCount: 0,
      lastUsedAt: null,
      rateLimitedUntil: null,
    });
  }

  async getStats(): Promise<{ total: number; active: number; rateLimited: number }> {
    const [total, active, rateLimited] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { status: 'active' } }),
      this.repo.count({ where: { status: 'rate_limited' } }),
    ]);
    return { total, active, rateLimited };
  }
}
