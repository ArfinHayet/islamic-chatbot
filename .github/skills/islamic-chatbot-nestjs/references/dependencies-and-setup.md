# Dependencies and Setup (Steps 1–4)

---

## Step 1 — package.json

Generate `package.json` with these exact dependencies:

```json
{
  "name": "islamic-chatbot",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/throttler": "^5.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "axios": "^1.6.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0",
    "typescript": "^5.1.3"
  }
}
```

---

## Step 2 — .env.example

```env
# Database (Supabase PostgreSQL URI)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Hadith API (https://hadithapi.com — free tier)
HADITH_API_KEY=your_hadith_api_key_here

# RAG Cache
SIMILARITY_THRESHOLD=0.85
MAX_CACHE_SEARCH=500

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=20

# Server
PORT=3000
```

---

## Step 3 — src/config/configuration.ts

```typescript
export default () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    chatModel: 'gemini-1.5-flash',
    embeddingModel: 'text-embedding-004',
  },
  hadith: {
    apiKey: process.env.HADITH_API_KEY,
  },
  rag: {
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.85'),
    maxCacheSearch: parseInt(process.env.MAX_CACHE_SEARCH || '500'),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
    limit: parseInt(process.env.THROTTLE_LIMIT || '20'),
  },
});
```

---

## Step 4 — src/app.module.ts

Requirements:
- `ConfigModule.forRoot({ isGlobal: true, load: [configuration] })`
- `TypeOrmModule.forRootAsync` — use `DATABASE_URL` from config, set `ssl: { rejectUnauthorized: false }`, `synchronize: false`, `entities: [CacheEntity]`
- `ThrottlerModule.forRootAsync` — read `ttl` and `limit` from `ConfigService`
- Import: `ChatModule`, `GeminiModule`, `McpModule`, `RagModule`
- Apply `ThrottlerGuard` as a global guard via `APP_GUARD`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { CacheEntity } from './rag/entities/cache.entity';
import { ChatModule } from './chat/chat.module';
import { GeminiModule } from './gemini/gemini.module';
import { McpModule } from './mcp/mcp.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        ssl: { rejectUnauthorized: false },
        synchronize: false,
        logging: false,
        entities: [CacheEntity],
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl'),
            limit: config.get<number>('throttle.limit'),
          },
        ],
      }),
    }),
    ChatModule,
    GeminiModule,
    McpModule,
    RagModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```
