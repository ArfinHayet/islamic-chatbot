# Services (Steps 5–8)

---

## Step 5 — src/rag/entities/cache.entity.ts

> **IMPORTANT:** The `embedding` column is stored as `text` in the TypeORM entity but as `vector(768)` in the actual Postgres schema. Schema is managed by `ensureVectorExtension()` in `RagService.onModuleInit()`, NOT by TypeORM `synchronize`. The TypeORM entity is used only for typing.

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('islamic_cache')
export class CacheEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  // Stored as text in TypeORM; actual DB column is vector(768) managed via raw SQL
  @Column({ type: 'text' })
  embedding: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## Step 6 — src/gemini/gemini.service.ts

Define these interfaces at the top of the file:

```typescript
interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: { result: string } } }>;
}

interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
  }>;
}
```

### 6a — generateEmbedding(text: string): Promise<number[]>

```
POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={API_KEY}
Body: { "model": "models/text-embedding-004", "content": { "parts": [{ "text": "..." }] } }
```

Returns `response.data.embedding.values` — a `number[]` of 768 dimensions.

### 6b — chat(messages, tools): Promise<GeminiResponse>

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}
```

Request body:
```json
{
  "system_instruction": { "parts": [{ "text": "SYSTEM_PROMPT" }] },
  "contents": [ ...messages ],
  "tools": [ { "function_declarations": [...tools] } ],
  "tool_config": { "function_calling_config": { "mode": "AUTO" } }
}
```

Tool result format to append to messages array:
```json
{
  "role": "user",
  "parts": [{
    "function_response": {
      "name": "tool_name",
      "response": { "result": "...JSON.stringify of result..." }
    }
  }]
}
```

### 6c — runAgenticLoop(systemPrompt, history, tools): Promise<string>

Agentic loop — max 5 iterations:
1. Call `chat()` with current messages + `systemPrompt`
2. Check `response.candidates[0].content.parts` for any part with `functionCall`
3. If `functionCall` found → call `this.mcpService.executeTool(name, args)` → append `function_response` message → loop again
4. If no `functionCall` → join all `text` parts → return final string
5. If max iterations reached → return whatever text is available

```typescript
// GeminiService injects McpService
constructor(
  private readonly configService: ConfigService,
  private readonly mcpService: McpService,
) {}
```

`GeminiModule` must import `McpModule` to make `McpService` available.

---

## Step 7 — src/mcp/tools/islamic.tools.ts

```typescript
export const ISLAMIC_TOOLS = [
  {
    name: 'search_quran_by_topic',
    description: `Search the Quran by topic or keyword. ALWAYS use this tool when the user asks about any Quranic topic, verse, or teaching. NEVER pick surah/ayah from memory. Returns top 3 matching verses with references.`,
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Topic to search e.g. patience, prayer, forgiveness, justice',
        },
        translation: {
          type: 'string',
          description: 'Translation edition. Default: en.sahih',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'search_hadith_by_topic',
    description: `Search authentic Hadith collections by topic. ALWAYS use this tool for any Hadith reference. NEVER quote Hadith from memory. Returns top 3 matching hadiths with references.`,
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Topic to search e.g. patience, fasting, charity',
        },
        collection: {
          type: 'string',
          description: 'Collection: bukhari | muslim | abudawud | tirmidhi | ibnmajah',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_prayer_times',
    description: 'Get Islamic prayer times for a specific city and country.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['city', 'country'],
    },
  },
];
```

---

## Step 8 — src/mcp/mcp.service.ts

`executeTool(toolName: string, toolInput: Record<string, string>): Promise<unknown>`

| Tool | API | Default |
|------|-----|---------|
| `search_quran_by_topic` | `GET https://api.alquran.cloud/v1/search/{keyword}/all/{translation}` | translation: `en.sahih` |
| `search_hadith_by_topic` | `GET https://hadithapi.com/api/hadiths/?apiKey={key}&book={collection}&paginate=3&keyword={keyword}` | collection: `bukhari` |
| `get_prayer_times` | `GET https://api.aladhan.com/v1/timingsByCity?city={city}&country={country}&method=2` | — |

Return shapes:

**search_quran_by_topic** — return top 3 matches:
```typescript
{ reference: string; arabicName: string; text: string }[]
// If empty: { found: false, message: 'No verses found for: {keyword}' }
```

**search_hadith_by_topic** — return top 3 matches:
```typescript
{ reference: string; narrator: string; text: string }[]
// If empty: { found: false, message: 'No hadith found for: {keyword}' }
```

**get_prayer_times** — return `response.data.data.timings`

Wrap all axios calls in `try/catch`, return `{ error: string }` on failure. Inject `ConfigService` for `hadith.apiKey`.
