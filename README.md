# Islamic Chatbot — NestJS Backend

Islamic Q&A chatbot REST API. Powered by Google Gemini 1.5 Flash with tool-augmented Quran/Hadith lookups, pgvector RAG caching, and `@nestjs/throttler` rate limiting. No authentication required.

---

## Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension (or Supabase — has pgvector built-in)
- Google AI Studio account (for Gemini API key)
- HadithAPI.com account (free tier)

---

## Setup

```bash
git clone <repo>
cd islamic-chatbot
npm install
cp .env.example .env
# Fill in .env values (see API Keys section)
npm run start:dev
```

---

## API Keys

| Key | Where to get |
|-----|-------------|
| `GEMINI_API_KEY` | https://aistudio.google.com → Get API key |
| `HADITH_API_KEY` | https://hadithapi.com → Register → API Key |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI mode) |

---

## Enable pgvector on Supabase

Supabase → Project → Database → Extensions → search "vector" → Enable

The `islamic_cache` table and `ivfflat` index are created automatically on startup by `RagService.onModuleInit()`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat` | Send a message, get an Islamic Q&A response |
| `GET` | `/api/v1/chat/health` | Health check |

---

## Example Request

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
    "reply": "Surah Al-Baqarah (2:153): O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.",
    "source": "model",
    "similarity": null
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Cached response (subsequent identical/similar question):

```json
{
  "success": true,
  "data": {
    "reply": "...",
    "source": "cache",
    "similarity": 0.97
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Rate Limiting

- 20 requests per 60 seconds per IP (configurable via `THROTTLE_LIMIT` / `THROTTLE_TTL`)
- Exceeding the limit returns HTTP 429:

```json
{
  "success": false,
  "error": "ThrottlerException: Too Many Requests",
  "statusCode": 429,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Architecture

```
POST /api/v1/chat
   │
   ▼
ChatService
   ├── GeminiService.generateEmbedding()   → text-embedding-004
   ├── RagService.searchSimilar()           → pgvector cosine similarity
   │     └── Cache hit → return immediately
   │
   └── Cache miss:
         GeminiService.runAgenticLoop()     → gemini-1.5-flash
               ├── Tool call: search_quran_by_topic  → alquran.cloud API
               ├── Tool call: search_hadith_by_topic → hadithapi.com API
               └── Tool call: get_prayer_times       → aladhan.com API
         RagService.saveToCache()           → pgvector INSERT (non-blocking)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Supabase PostgreSQL connection URI |
| `GEMINI_API_KEY` | — | Google AI Studio API key |
| `HADITH_API_KEY` | — | HadithAPI.com API key |
| `SIMILARITY_THRESHOLD` | `0.85` | Minimum cosine similarity for cache hits |
| `MAX_CACHE_SEARCH` | `500` | Max rows to scan during similarity search |
| `THROTTLE_TTL` | `60000` | Rate limit window in milliseconds |
| `THROTTLE_LIMIT` | `20` | Max requests per window per IP |
| `PORT` | `3000` | Server port |
