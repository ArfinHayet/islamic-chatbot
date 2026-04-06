import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CacheEntity } from './entities/cache.entity';

interface CachedResult {
  answer: string;
  similarity: number;
  question: string;
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectRepository(CacheEntity)
    private readonly cacheRepo: Repository<CacheEntity>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureVectorExtension();
  }

  private async ensureVectorExtension(): Promise<void> {
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS islamic_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding vector(768) NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Migrate column to vector(768) if it exists with different dimensions
    await this.dataSource.query(`
      DO $$
      DECLARE v_typmod integer;
      BEGIN
        SELECT atttypmod INTO v_typmod
        FROM pg_attribute
        WHERE attrelid = 'islamic_cache'::regclass
          AND attname = 'embedding'
          AND NOT attisdropped;
        IF FOUND AND v_typmod IS NOT NULL AND v_typmod != 768 THEN
          DROP INDEX IF EXISTS islamic_cache_embedding_idx;
          TRUNCATE TABLE islamic_cache;
          ALTER TABLE islamic_cache DROP COLUMN embedding;
          ALTER TABLE islamic_cache ADD COLUMN embedding vector(768) NOT NULL;
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
      END$$
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS islamic_cache_embedding_idx 
      ON islamic_cache USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    this.logger.log('Vector extension and cache table ensured');
  }

  async searchSimilar(queryEmbedding: number[]): Promise<CachedResult | null> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const result = await this.dataSource.query<
      Array<{ question: string; answer: string; similarity: string }>
    >(
      `SELECT 
         question,
         answer,
         1 - (embedding::vector <=> $1::vector) AS similarity
       FROM islamic_cache
       ORDER BY embedding::vector <=> $1::vector
       LIMIT 1`,
      [embeddingStr],
    );

    const threshold = this.configService.get<number>('rag.similarityThreshold') ?? 0.85;
    if (result.length > 0 && parseFloat(result[0].similarity) >= threshold) {
      return {
        answer: result[0].answer,
        similarity: parseFloat(result[0].similarity),
        question: result[0].question,
      };
    }
    return null;
  }

  async saveToCache(question: string, answer: string, embedding: number[]): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO islamic_cache (id, question, answer, embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())`,
      [question, answer, `[${embedding.join(',')}]`],
    );
  }
}
