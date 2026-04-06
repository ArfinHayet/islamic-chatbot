---
name: islamic-chatbot-nestjs
description: "Generate a production-ready Islamic Q&A chatbot backend using NestJS, PostgreSQL with pgvector, Gemini 1.5 Flash, RAG-based semantic caching, MCP tool integration for Quran/Hadith APIs, and rate limiting. Use when: scaffolding an Islamic chatbot API, generating NestJS backend with RAG pipeline, creating Gemini function-calling agentic loop, setting up pgvector semantic cache with Supabase, building halal Q&A REST API. No frontend. No auth. Public API."
argument-hint: "Optional: describe any customizations (e.g. different LLM, add auth, custom tools)"
---

# Islamic Chatbot — NestJS Backend Generation Skill

You are generating a **complete, production-ready NestJS backend** for an Islamic Q&A chatbot. Read every section carefully before writing any code. Do not skip sections.

---

## Stack & Constraints

| Concern         | Choice                                      |
|----------------|---------------------------------------------|
| Framework       | NestJS (latest)                             |
| Language        | TypeScript (strict mode)                    |
| LLM             | Google Gemini 1.5 Flash (via REST API)      |
| Embeddings      | Gemini `text-embedding-004` model           |
| Database        | PostgreSQL + pgvector extension             |
| DB Host         | Supabase (connect via URI only, no SDK)     |
| ORM             | TypeORM                                     |
| Rate Limiting   | @nestjs/throttler                           |
| HTTP Client     | axios                                       |
| Config          | @nestjs/config + .env                       |
| Auth            | None — fully public API                     |
| Frontend        | None — API only                             |

---

## Project Structure

Generate ALL files in this exact structure:

```
islamic-chatbot/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── chat/
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   └── dto/
│   │       └── chat.dto.ts
│   ├── gemini/
│   │   ├── gemini.module.ts
│   │   └── gemini.service.ts
│   ├── mcp/
│   │   ├── mcp.module.ts
│   │   ├── mcp.service.ts
│   │   └── tools/
│   │       └── islamic.tools.ts
│   ├── rag/
│   │   ├── rag.module.ts
│   │   ├── rag.service.ts
│   │   └── entities/
│   │       └── cache.entity.ts
│   └── common/
│       ├── filters/
│       │   └── http-exception.filter.ts
│       └── interceptors/
│           └── response.interceptor.ts
├── .env.example
├── .env
├── package.json
└── tsconfig.json
```

---

## Generation Procedure

Follow all steps in order. Reference the detail files below for exact code to generate.

### Step Index

| Step | What to Generate | Reference |
|------|-----------------|-----------|
| 1    | `package.json` dependencies | [dependencies-and-setup.md](./references/dependencies-and-setup.md#step-1) |
| 2    | `.env.example` environment variables | [dependencies-and-setup.md](./references/dependencies-and-setup.md#step-2) |
| 3    | `src/config/configuration.ts` | [dependencies-and-setup.md](./references/dependencies-and-setup.md#step-3) |
| 4    | `src/app.module.ts` | [dependencies-and-setup.md](./references/dependencies-and-setup.md#step-4) |
| 5    | `src/rag/entities/cache.entity.ts` | [services.md](./references/services.md#step-5) |
| 6    | `src/gemini/gemini.service.ts` (embedding + agentic loop) | [services.md](./references/services.md#step-6) |
| 7    | `src/mcp/tools/islamic.tools.ts` | [services.md](./references/services.md#step-7) |
| 8    | `src/mcp/mcp.service.ts` | [services.md](./references/services.md#step-8) |
| 9    | System prompt constant | [orchestration.md](./references/orchestration.md#step-9) |
| 10   | `src/rag/rag.service.ts` (pgvector raw queries) | [orchestration.md](./references/orchestration.md#step-10) |
| 11   | `src/chat/chat.service.ts` (orchestration) | [orchestration.md](./references/orchestration.md#step-11) |
| 12   | Controller + DTO | [orchestration.md](./references/orchestration.md#step-12) |
| 13   | Response interceptor + exception filter | [orchestration.md](./references/orchestration.md#step-13) |
| 14   | `src/main.ts` bootstrap | [orchestration.md](./references/orchestration.md#step-14) |
| 15   | Rate limiting config | [orchestration.md](./references/orchestration.md#step-15) |
| 16   | TypeORM config rules | [quality-rules.md](./references/quality-rules.md#step-16) |
| 17   | Error handling rules | [quality-rules.md](./references/quality-rules.md#step-17) |
| 18   | Code quality rules | [quality-rules.md](./references/quality-rules.md#step-18) |
| 19   | `README.md` | [quality-rules.md](./references/quality-rules.md#step-19) |

---

## Final Checklist

Before outputting any file, verify:

- [ ] All modules import and export their dependencies correctly
- [ ] `RagModule` exports `RagService`; `GeminiModule` exports `GeminiService`; `McpModule` exports `McpService`
- [ ] `ChatModule` imports `RagModule`, `GeminiModule`, `McpModule`
- [ ] `GeminiService` injects `McpService` (imported via `McpModule`) — no circular deps
- [ ] TypeORM `DataSource` is available in `RagService` for raw queries
- [ ] `ensureVectorExtension()` is called in `RagService.onModuleInit()`
- [ ] The embedding vector dimension is **768** (Gemini `text-embedding-004`)
- [ ] `.env.example` is complete
- [ ] No hardcoded API keys anywhere
- [ ] Rate limiting is active globally
- [ ] Response interceptor wraps ALL responses in the standard shape
- [ ] `synchronize: false` — vector schema is managed by `ensureVectorExtension()`, not TypeORM
