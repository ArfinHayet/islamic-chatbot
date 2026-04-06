# Orchestration Layer (Steps 9–15)

---

## Step 9 — Islamic System Prompt

Define as a constant in `src/chat/chat.service.ts` or `src/chat/islamic.prompt.ts`:

```typescript
export const ISLAMIC_SYSTEM_PROMPT = `You are an Islamic scholar assistant. You ONLY answer questions related to Islam, including:
- Quran, Hadith, Fiqh, Aqeedah, Islamic history
- Halal/Haram rulings, worship (salah, sawm, zakat, hajj)
- Islamic ethics, family matters, daily life from an Islamic perspective
- Prophets, companions, Islamic scholars

STRICT DOMAIN RULE:
If the question is NOT related to Islam in any way, respond ONLY with:
"I'm only able to answer Islamic questions. Please ask something related to Islam."
Do NOT answer it. Do NOT make exceptions.

MANDATORY TOOL USAGE — FOLLOW THESE EVERY TIME:
1. QURAN VERSES:
   - NEVER quote or reference a Quran verse from memory
   - ALWAYS call "search_quran_by_topic" tool first to fetch the exact text
   - Only include a verse in your answer AFTER the tool returns it
   - Format: "Surah [Name] ([surah]:[ayah]): [tool result text]"

2. HADITH:
   - NEVER quote or reference a Hadith from memory
   - ALWAYS call "search_hadith_by_topic" tool first to fetch authenticated text
   - Only include a Hadith in your answer AFTER the tool returns it
   - Format: "[Collection] Hadith #[number]: [tool result text]"

3. PRAYER TIMES:
   - ALWAYS call "get_prayer_times" tool when user asks about salah times

ANSWER QUALITY RULES:
- Always cite exact sources returned by tools (never fabricate references)
- Mention scholarly differences (ikhtilaf) when they exist across madhabs
- Never issue personal fatwas — say "Please consult a qualified scholar for personal rulings"
- Use respectful Islamic language (e.g., Prophet Muhammad ﷺ, SubhanAllah)
- Reply in the same language the user writes in
- Your knowledge of Quran and Hadith texts may contain errors. Always trust tool results over your memory.`;
```

---

## Step 10 — src/rag/rag.service.ts

```typescript
@Injectable()
export class RagService implements OnModuleInit {
  constructor(
    @InjectRepository(CacheEntity)
    private cacheRepo: Repository<CacheEntity>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureVectorExtension();
  }
```

### ensureVectorExtension()

```typescript
async ensureVectorExtension(): Promise<void> {
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
  await this.dataSource.query(`
    CREATE INDEX IF NOT EXISTS islamic_cache_embedding_idx 
    ON islamic_cache USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `);
}
```

### searchSimilar(queryEmbedding: number[]): Promise<CachedResult | null>

```typescript
// Format embedding as PostgreSQL array literal: '[0.1,0.2,...]'
const embeddingStr = `[${queryEmbedding.join(',')}]`;

const result = await this.dataSource.query(
  `SELECT 
     question,
     answer,
     1 - (embedding::vector <=> $1::vector) AS similarity
   FROM islamic_cache
   ORDER BY embedding::vector <=> $1::vector
   LIMIT 1`,
  [embeddingStr]
);

const threshold = this.configService.get<number>('rag.similarityThreshold');
if (result.length > 0 && parseFloat(result[0].similarity) >= threshold) {
  return { answer: result[0].answer, similarity: parseFloat(result[0].similarity), question: result[0].question };
}
return null;
```

### saveToCache(question, answer, embedding): Promise<void>

```typescript
await this.dataSource.query(
  `INSERT INTO islamic_cache (id, question, answer, embedding, "createdAt")
   VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())`,
  [question, answer, `[${embedding.join(',')}]`]
);
```

---

## Step 11 — src/chat/chat.service.ts

Chat flow:

```typescript
async chat(userId: string, message: string): Promise<ChatResponse> {
  // 1. Generate embedding for incoming message
  const embedding = await this.geminiService.generateEmbedding(message);

  // 2. Search RAG cache
  try {
    const cached = await this.ragService.searchSimilar(embedding);
    if (cached) {
      this.logger.log(`Cache hit for user ${userId}: similarity=${cached.similarity}`);
      return { reply: cached.answer, source: 'cache', similarity: cached.similarity };
    }
  } catch (err) {
    this.logger.warn(`Cache search failed, falling through to model: ${err.message}`);
  }

  // 3. Build history for this user (keep last 10 messages)
  if (!this.history.has(userId)) this.history.set(userId, []);
  const userHistory = this.history.get(userId);
  userHistory.push({ role: 'user', parts: [{ text: message }] });
  if (userHistory.length > 10) userHistory.splice(0, userHistory.length - 10);

  // 4. Run agentic loop
  const reply = await this.geminiService.runAgenticLoop(
    ISLAMIC_SYSTEM_PROMPT,
    [...userHistory],
    ISLAMIC_TOOLS,
  );

  // 5. Check for refusal
  const isRefusal = reply.startsWith("I'm only able to answer Islamic questions");
  if (isRefusal) {
    // Remove user message from history — do not persist refusals
    userHistory.pop();
    return { reply, source: 'model', similarity: null };
  }

  // 6. Add assistant reply to history
  userHistory.push({ role: 'model', parts: [{ text: reply }] });

  // 7. Save to cache (non-blocking, log on failure)
  this.ragService
    .saveToCache(message, reply, embedding)
    .catch((err) => this.logger.warn(`Cache save failed: ${err.message}`));

  return { reply, source: 'model', similarity: null };
}

private readonly history = new Map<string, GeminiMessage[]>();
```

---

## Step 12 — Controller and DTO

### src/chat/dto/chat.dto.ts

```typescript
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  message: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
```

### src/chat/chat.controller.ts

```typescript
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() dto: ChatDto): Promise<ChatResponse> {
    return this.chatService.chat(dto.userId, dto.message);
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

---

## Step 13 — Response Interceptor and Exception Filter

### src/common/interceptors/response.interceptor.ts

```typescript
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### src/common/filters/http-exception.filter.ts

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      success: false,
      error: exception.message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Step 14 — src/main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*' });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🕌 Islamic Chatbot API running on port ${port}`);
}
bootstrap();
```

---

## Step 15 — Rate Limiting

- `ThrottlerModule` is configured globally in `AppModule` (Step 4)
- Default: 20 requests per 60 seconds per IP
- `ThrottlerGuard` applied as `APP_GUARD` — covers all routes automatically
- On rate limit exceeded, NestJS/throttler throws `ThrottlerException` (extends `HttpException` with 429)
- `HttpExceptionFilter` catches it and returns the standard error shape
