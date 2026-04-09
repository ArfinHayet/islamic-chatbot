import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { RagService, HadithSearchResult } from '../rag/rag.service';
import { GeminiKeyService } from '../rag/services/gemini-key.service';

interface PrayerTimesResponse {
  data: {
    timings: Record<string, string>;
  };
}

interface QuranResult {
  reference: string;
  arabicName: string;
  text_ar: string;
  translation: string;
}

interface HadithResult {
  reference: string;
  narrator: string | null;
  text_ar: string;
  text_en: string | null;
  grade: string | null;
}

interface NotFoundResult {
  found: false;
  message: string;
}

interface ErrorResult {
  error: string;
}

type ToolResult =
  | QuranResult[]
  | HadithResult[]
  | Record<string, string>
  | NotFoundResult
  | ErrorResult;

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly embeddingModelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ragService: RagService,
    private readonly geminiKeyService: GeminiKeyService,
  ) {
    this.embeddingModelName =
      this.configService.get<string>('gemini.embeddingModel') ?? 'gemini-embedding-001';
  }

  private isRateLimitError(err: unknown): boolean {
    const msg = (err as Error)?.message ?? '';
    return msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota');
  }

  /**
   * Embed text with automatic key rotation on 429 errors.
   * Tries each available key once before giving up.
   */
  private async embedWithRotation(text: string): Promise<number[]> {
    const stats = await this.geminiKeyService.getStats();
    const maxAttempts = (stats.total || 1) + 1;
    let lastError: Error = new Error('No keys tried');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const row = await this.geminiKeyService.getNextKey();
      const apiKey = row?.apiKey ?? this.configService.get<string>('gemini.apiKey');
      if (!apiKey) throw new Error('No Gemini API keys available');

      try {
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
          model: this.embeddingModelName,
        });
        const result = await model.embedContent({
          content: { parts: [{ text }], role: 'user' },
          outputDimensionality: 768,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return result.embedding.values;
      } catch (err) {
        lastError = err as Error;
        if (this.isRateLimitError(err) && row?.id) {
          this.logger.warn(`MCP embed key ${row.id.slice(0, 8)}… rate-limited, rotating...`);
          await this.geminiKeyService.markRateLimited(row.id);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  async executeTool(toolName: string, toolInput: Record<string, string>): Promise<ToolResult> {
    switch (toolName) {
      case 'search_quran_by_topic':
        return this.searchQuranByTopic(toolInput.keyword, toolInput.language);
      case 'search_hadith_by_topic':
        return this.searchHadithByTopic(toolInput.keyword, toolInput.collection);
      case 'get_prayer_times':
        return this.getPrayerTimes(toolInput.city, toolInput.country);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async searchQuranByTopic(
    keyword: string,
    language = 'en',
  ): Promise<QuranResult[] | NotFoundResult | ErrorResult> {
    try {
      const embedding = await this.embedWithRotation(keyword);
      const verses = await this.ragService.searchQuranVerses(embedding, language, 5);

      if (verses.length === 0) {
        return { found: false, message: `No verses found in database for: ${keyword}` };
      }

      return verses.map((v) => ({
        reference: `Surah ${v.chapter_name} (${v.chapter_number}:${v.verse_number})`,
        arabicName: v.chapter_name,
        text_ar: v.text_ar,
        translation: v.translation ?? v.text_ar,
      }));
    } catch (error) {
      this.logger.warn(`Quran search failed for "${keyword}": ${(error as Error).message}`);
      return { error: `Failed to search Quran: ${(error as Error).message}` };
    }
  }

  private async searchHadithByTopic(
    keyword: string,
    collection?: string,
  ): Promise<HadithResult[] | NotFoundResult | ErrorResult> {
    try {
      const embedding = await this.embedWithRotation(keyword);
      const results: HadithSearchResult[] = await this.ragService.searchHadiths(
        embedding,
        collection,
        5,
      );

      if (results.length === 0) {
        return { found: false, message: `No hadith found in local database for: ${keyword}` };
      }

      return results.map((h) => ({
        reference: `${h.collection_name} Hadith #${h.hadith_number}${
          h.chapter_name ? ` — ${h.chapter_name}` : ''
        }`,
        narrator: h.narrator_en,
        text_ar: h.text_ar,
        text_en: h.text_en,
        grade: h.grade,
      }));
    } catch (error) {
      this.logger.warn(`Hadith search failed for "${keyword}": ${(error as Error).message}`);
      return { error: `Failed to search Hadith: ${(error as Error).message}` };
    }
  }

  private async getPrayerTimes(
    city: string,
    country: string,
  ): Promise<Record<string, string> | ErrorResult> {
    try {
      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`;
      const response = await axios.get<PrayerTimesResponse>(url);
      return response.data.data.timings;
    } catch (error) {
      this.logger.warn(
        `Prayer times lookup failed for ${city}, ${country}: ${(error as Error).message}`,
      );
      return { error: `Failed to get prayer times: ${(error as Error).message}` };
    }
  }
}

