# Quality Rules and README (Steps 16–19)

---

## Step 16 — TypeORM Configuration Rules

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get<string>('database.url'),
    ssl: { rejectUnauthorized: false }, // Required for Supabase
    synchronize: false, // IMPORTANT: vector(768) schema managed by ensureVectorExtension()
    logging: false,
    entities: [CacheEntity],
  }),
})
```

**Why `synchronize: false`:** TypeORM does not natively support the `vector` type. If `synchronize: true`, TypeORM would overwrite the `vector(768)` column with `text`, breaking pgvector queries. Schema is managed exclusively by `RagService.ensureVectorExtension()` on startup.

---

## Step 17 — Error Handling Rules

| Scenario | Action |
|----------|--------|
| Gemini embedding API failure | Throw `HttpException` 503 |
| Gemini chat API failure | Throw `HttpException` 502 |
| Quran/Hadith/Aladhan API failure | Return `{ error: string }` from `McpService` (tool errors are non-fatal) |
| RAG cache search failure | Log warning, fall through to model call — **never block the user** |
| RAG cache save failure | Log warning, do not throw — non-critical path |
| Validation failure | `ValidationPipe` handles automatically, returns 400 |
| Rate limit exceeded | `ThrottlerGuard` and `HttpExceptionFilter` return 429 |

Always use `private readonly logger = new Logger(ServiceName.name)` for logging within services.

---

## Step 18 — Code Quality Rules

1. **Every service must be `@Injectable()`**
2. **Every module must declare and export its providers correctly:**
   - `RagModule`: exports `RagService`, imports `TypeOrmModule.forFeature([CacheEntity])`
   - `GeminiModule`: exports `GeminiService`, imports `McpModule`
   - `McpModule`: exports `McpService`
   - `ChatModule`: imports `RagModule`, `GeminiModule`, `McpModule`
3. **No `any` types** — define interfaces for all Gemini API request/response shapes
4. **Inject `ConfigService`** for all env values — never access `process.env` directly outside `configuration.ts`
5. **Use `async/await`** — no `.then()` chains
6. **All controllers use DTOs** with `class-validator` decorators
7. **No business logic in controllers** — controllers only call service methods
8. **Logger per service:** `private readonly logger = new Logger(ClassName.name)`
9. **Avoid circular dependencies:** `GeminiService` → `McpService` (not the other way around)

---

## Step 19 — README.md

Generate `README.md` with the following sections:

### 1. Overview
Islamic Q&A chatbot REST API. Powered by Google Gemini 1.5 Flash with tool-augmented Quran/Hadith lookups, pgvector RAG caching, and @nestjs/throttler rate limiting. No authentication required.

### 2. Prerequisites
- Node.js 18+
- PostgreSQL with pgvector extension (or Supabase — has pgvector built-in)
- Google AI Studio account (for Gemini API key)
- HadithAPI.com account (free tier)

### 3. Setup
```bash
git clone <repo>
cd islamic-chatbot
npm install
cp .env.example .env
# Fill in .env values (see section 4)
npm run start:dev
```

### 4. API Keys
| Key | Where to get |
|-----|-------------|
| `GEMINI_API_KEY` | https://aistudio.google.com → Get API key |
| `HADITH_API_KEY` | https://hadithapi.com → Register → API Key |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI mode) |

### 5. Enable pgvector on Supabase
Supabase → Project → Database → Extensions → search "vector" → Enable

### 6. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat` | Send a message, get an Islamic Q&A response |
| `GET` | `/api/v1/chat/health` | Health check |

### 7. Example Request
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{ "message": "What does the Quran say about patience?", "userId": "user-123" }'
```

Example response:
```json
{
  "success": true,
  "data": {
    "reply": "Surah Al-Baqarah (2:153): ...",
    "source": "model",
    "similarity": null
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Rate Limiting
- 20 requests per 60 seconds per IP
- Exceeding the limit returns HTTP 429 with the standard error shape
