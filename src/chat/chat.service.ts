import { Injectable, Logger } from '@nestjs/common';
import { GeminiService, GeminiMessage } from '../gemini/gemini.service';
import { RagService } from '../rag/rag.service';
import { ISLAMIC_TOOLS } from '../mcp/tools/islamic.tools';
import { GeoLocation } from '../common/services/geo.service';

const BASE_SYSTEM_PROMPT = `You are an Islamic scholar assistant. You ONLY answer questions related to Islam, including:
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
For ANY Islamic question — even if the user does NOT explicitly mention Quran or Hadith — you MUST call BOTH search tools before composing your answer. The user asking "নিসাব পরিমাণ সম্পদ কত?" or "What is the ruling on fasting?" is the same as asking for Quran and Hadith evidence. Always search both.

1. QURAN VERSES:
   - NEVER quote or reference a Quran verse from memory
   - ALWAYS call "search_quran_by_topic" tool for EVERY Islamic question, regardless of whether the user mentions the Quran
   - Pass the detected language code as the "language" parameter so you get the correct translation
   - Only include a verse in your answer AFTER the tool returns it
   - If tool returns nothing, say "I couldn't find a relevant Quran verse on this topic"
   - Always cite each verse in this format:
       Surah [Name] ([surah]:[ayah]):
       Arabic: [text_ar from tool result]
       Translation: [translation from tool result]
   - If multiple verses are relevant, include up to 5, each with its own reference

2. HADITH:
   - NEVER quote or reference a Hadith from memory
   - ALWAYS call "search_hadith_by_topic" tool for EVERY Islamic question, regardless of whether the user mentions Hadith
   - Only include a Hadith in your answer AFTER the tool returns it
   - Format: "[Collection] Hadith #[number]: [tool result text]"

3. PRAYER TIMES:
   - ALWAYS call "get_prayer_times" tool when user asks about salah/prayer times
   - NEVER ask the user for their city or country — it is auto-detected and will appear in the USER LOCATION section below
   - Use the USER LOCATION city and country DIRECTLY as arguments to "get_prayer_times" WITHOUT asking the user
   - Only ask for location if the USER LOCATION section is completely absent AND the user has not mentioned a city or country

ANSWER QUALITY RULES:
- Always cite exact sources returned by tools (never fabricate references)
- Mention scholarly differences (ikhtilaf) when they exist across madhabs
- Never issue personal fatwas — say "Please consult a qualified scholar for personal rulings"
- Use respectful Islamic language (e.g., Prophet Muhammad ﷺ, SubhanAllah)
- Your knowledge of Quran and Hadith texts may contain errors. Always trust tool results over your memory.
- The Quran verse tool performs cross-lingual semantic search — a question in any language will find relevant verses. Trust it.`;

export function buildSystemPrompt(location?: GeoLocation | null): string {
  if (!location) return BASE_SYSTEM_PROMPT;
  return (
    BASE_SYSTEM_PROMPT +
    `\n\n--- USER LOCATION (auto-detected) ---\n` +
    `City: ${location.city}\n` +
    `Country: ${location.country}\n` +
    `IMPORTANT: Use this city and country DIRECTLY when calling "get_prayer_times". Do NOT ask the user for their location.\n` +
    `--- END USER LOCATION ---`
  );
}

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

  private normalizeQuery(query: string): string {
    // Trim whitespace and strip trailing punctuation that doesn't affect meaning:
    // ? (Latin), ؟ (Arabic), ! (exclamation), । (Bangla/Hindi danda), . (period)
    return query.trim().replace(/[?؟!।.]+$/u, '').trim();
  }

  /**
   * Returns true if the message is asking about prayer/salah times.
   * These are real-time queries and must never be served from cache.
   */
  private isPrayerTimeQuery(message: string): boolean {
    const lower = message.toLowerCase();
    // English
    if (/prayer\s*time|salah\s*time|namaz\s*time|salat\s*time/.test(lower)) return true;
    // Bengali (Banglish + Unicode)
    if (/namajer\s*(somoy|time|waqt)|namaz\s*(somoy|time)|নামাজের\s*সময়|নামাযের\s*সময়/.test(lower)) return true;
    // Arabic
    if (/وقت\s*(الصلاة|صلاة)|مواقيت\s*الصلاة/.test(message)) return true;
    // Generic time-of-prayer keywords across languages
    if (/(fajr|dhuhr|zuhr|asr|maghrib|isha|magrib|এশা|ফজর|যোহর|আসর|মাগরিব).*?(time|somoy|waqt|سময়|وقت)/.test(lower)) return true;
    if (/(time|somoy|waqt).*?(fajr|dhuhr|zuhr|asr|maghrib|isha|magrib|এশা|ফজর|যোহর|আসর|মাগরিব)/.test(lower)) return true;
    return false;
  }

  async chat(userId: string, message: string, location?: GeoLocation | null): Promise<ChatResponse> {
    // 1. Generate embedding for incoming message (normalized for consistent cache keys)
    const normalizedMessage = this.normalizeQuery(message);
    const skipCache = this.isPrayerTimeQuery(message);
    const embedding = skipCache ? [] : await this.geminiService.generateEmbedding(normalizedMessage);

    // 2. Search RAG cache (skip for real-time queries like prayer times)
    if (!skipCache) {
      try {
        const cached = await this.ragService.searchSimilar(embedding);
        if (cached) {
          this.logger.log(`Cache hit for user ${userId}: similarity=${cached.similarity}`);
          return { reply: cached.answer, source: 'cache', similarity: cached.similarity };
        }
      } catch (err) {
        this.logger.warn(`Cache search failed, falling through to model: ${(err as Error).message}`);
      }
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
      buildSystemPrompt(location),
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

    // 7. Save to cache (skip for real-time queries like prayer times)
    if (!skipCache) {
      this.ragService
        .saveToCache(normalizedMessage, reply, embedding)
        .catch((err) => this.logger.warn(`Cache save failed: ${(err as Error).message}`));
    }

    return { reply, source: 'model', similarity: null };
  }

  async *chatStream(userId: string, message: string, location?: GeoLocation | null): AsyncGenerator<StreamChunk> {
    const normalizedMessage = this.normalizeQuery(message);
    const skipCache = this.isPrayerTimeQuery(message);
    const embedding = skipCache ? [] : await this.geminiService.generateEmbedding(normalizedMessage);

    // Cache hit — yield full answer as one chunk (skip for real-time queries)
    if (!skipCache) {
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
        buildSystemPrompt(location),
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

    if (!skipCache) {
      this.ragService
        .saveToCache(normalizedMessage, fullReply, embedding)
        .catch((err) => this.logger.warn(`Cache save failed: ${(err as Error).message}`));
    }

    yield { type: 'done', source: 'model', similarity: null };
  }
}
