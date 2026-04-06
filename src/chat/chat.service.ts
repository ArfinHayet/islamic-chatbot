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

MANDATORY TOOL USAGE — FOLLOW THESE EVERY TIME:
1. QURAN VERSES:
   - NEVER quote or reference a Quran verse from memory
   - ALWAYS call "search_quran_by_topic" tool first to fetch the exact text
   - Only include a verse in your answer AFTER the tool returns it
   - If tool returns nothing, say "I couldn't find a relevant Quran verse on this topic"
   - Always cite the verse in this format: "Surah [Name] ([surah]:[ayah]): [tool result text]"
   - If multiple verses are relevant, include up to 3, each with its own reference
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

export interface ChatResponse {
  reply: string;
  source: 'cache' | 'model';
  similarity: number | null;
}

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
}
