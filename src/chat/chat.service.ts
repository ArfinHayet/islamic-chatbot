import { Injectable, Logger } from '@nestjs/common';
import { GeminiService, GeminiMessage } from '../gemini/gemini.service';
import { RagService } from '../rag/rag.service';
import { ISLAMIC_TOOLS } from '../mcp/tools/islamic.tools';

export const ISLAMIC_SYSTEM_PROMPT = `You are an Islamic scholar assistant. You ONLY answer questions related to Islam, including:
- Quran, Hadith, Fiqh, Aqeedah, Islamic history
- Halal/Haram rulings, worship (salah, sawm, zakat, hajj)
- Islamic ethics, family matters, daily life from an Islamic perspective
- Prophets, companions, Islamic scholars

STRICT DOMAIN RULE:
If the question is NOT related to Islam in any way, respond ONLY with:
"I'm only able to answer Islamic questions. Please ask something related to Islam."
Do NOT answer it. Do NOT make exceptions.

LANGUAGE DETECTION:
- Detect the language the user is writing in.
- Map it to one of these supported codes: ar (Arabic), bn (Bengali), en (English), es (Spanish), fr (French), id (Indonesian), ru (Russian), tr (Turkish), zh (Chinese).
- If the user's language is not in the list, use "en" as the fallback.
- Pass this language code as the "language" parameter when calling "search_quran_by_topic".
- ALWAYS respond in the same language the user writes in, including all Islamic citations.

MANDATORY TOOL USAGE — FOLLOW THESE EVERY TIME:
1. QURAN VERSES:
   - NEVER quote or reference a Quran verse from memory
   - ALWAYS call "search_quran_by_topic" tool first to fetch the exact text
   - Pass the detected language code as the "language" parameter so you get the correct translation
   - CRITICAL — keyword language: The "keyword" parameter MUST be in English or Arabic regardless of what language the user wrote in. Transliterate proper nouns and Islamic figure names to standard English (e.g. "Dhul-Qarnayn", "Ibrahim", "Musa", "Maryam", "Luqman"). Use English concepts for topics (e.g. "patience", "prayer", "resurrection"). This is essential because the semantic search index is optimized for English/Arabic keywords.
   - Only include a verse in your answer AFTER the tool returns it
   - If tool returns nothing, say "I couldn't find a relevant Quran verse on this topic"
   - Always cite each verse in this format:
       Surah [Name] ([surah]:[ayah]):
       Arabic: [text_ar from tool result]
       Translation: [translation from tool result]
   - If multiple verses are relevant, include up to 5, each with its own reference

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
- Your knowledge of Quran and Hadith texts may contain errors. Always trust tool results over your memory.
- The Quran verse tool performs cross-lingual semantic search — a question in any language will find relevant verses. Trust it.`;

export interface ChatResponse {
  reply: string;
  source: 'cache' | 'model';
  similarity: number | null;
}

export type StreamChunk =
  | { type: 'chunk'; text: string }
  | { type: 'done'; source: 'cache' | 'model'; similarity: number | null };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly history = new Map<string, GeminiMessage[]>();

  constructor(
    private readonly geminiService: GeminiService,
    private readonly ragService: RagService,
  ) {}

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
      this.logger.warn(`Cache search failed, falling through to model: ${(err as Error).message}`);
    }

    // 3. Build history for this user (keep last 10 messages)
    if (!this.history.has(userId)) {
      this.history.set(userId, []);
    }
    const userHistory = this.history.get(userId) as GeminiMessage[];
    userHistory.push({ role: 'user', parts: [{ text: message }] });
    if (userHistory.length > 10) {
      userHistory.splice(0, userHistory.length - 10);
    }

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
      .catch((err) => this.logger.warn(`Cache save failed: ${(err as Error).message}`));

    return { reply, source: 'model', similarity: null };
  }

  async *chatStream(userId: string, message: string): AsyncGenerator<StreamChunk> {
    const embedding = await this.geminiService.generateEmbedding(message);

    // Cache hit — yield full answer as one chunk
    try {
      const cached = await this.ragService.searchSimilar(embedding);
      if (cached) {
        this.logger.log(`Cache hit for user ${userId}: similarity=${cached.similarity}`);
        yield { type: 'chunk', text: cached.answer };
        yield { type: 'done', source: 'cache', similarity: cached.similarity };
        return;
      }
    } catch (err) {
      this.logger.warn(`Cache search failed, falling through to model: ${(err as Error).message}`);
    }

    // Build history
    if (!this.history.has(userId)) this.history.set(userId, []);
    const userHistory = this.history.get(userId) as GeminiMessage[];
    userHistory.push({ role: 'user', parts: [{ text: message }] });
    if (userHistory.length > 10) userHistory.splice(0, userHistory.length - 10);

    // Stream from Gemini, accumulate full reply for cache + history
    let fullReply = '';
    try {
      for await (const chunk of this.geminiService.runAgenticLoopStream(
        ISLAMIC_SYSTEM_PROMPT,
        [...userHistory],
        ISLAMIC_TOOLS,
      )) {
        fullReply += chunk;
        yield { type: 'chunk', text: chunk };
      }
    } catch (err) {
      userHistory.pop();
      throw err;
    }

    const isRefusal = fullReply.startsWith("I'm only able to answer Islamic questions");
    if (isRefusal) {
      userHistory.pop();
      yield { type: 'done', source: 'model', similarity: null };
      return;
    }

    userHistory.push({ role: 'model', parts: [{ text: fullReply }] });

    this.ragService
      .saveToCache(message, fullReply, embedding)
      .catch((err) => this.logger.warn(`Cache save failed: ${(err as Error).message}`));

    yield { type: 'done', source: 'model', similarity: null };
  }
}
