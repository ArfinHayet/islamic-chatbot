import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { RagService } from '../rag/rag.service';

interface HadithItem {
  hadithNumber: string | number;
  hadithEnglish: string;
  englishNarrator: string;
  book?: { bookName: string };
}

interface HadithSearchResponse {
  hadiths: {
    data: HadithItem[];
  };
}

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
  narrator: string;
  text: string;
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
  private readonly embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(
    private readonly configService: ConfigService,
    private readonly ragService: RagService,
  ) {
    // Own embedding client — avoids circular dependency (GeminiService already imports McpService)
    const apiKey = this.configService.get<string>('gemini.apiKey') as string;
    const modelName =
      this.configService.get<string>('gemini.embeddingModel') ?? 'gemini-embedding-001';
    const genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = genAI.getGenerativeModel({ model: modelName });
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
      const embeddingResult = await this.embeddingModel.embedContent({
        content: { parts: [{ text: keyword }], role: 'user' },
        outputDimensionality: 768,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const embedding: number[] = embeddingResult.embedding.values;

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
    collection = 'bukhari',
  ): Promise<HadithResult[] | NotFoundResult | ErrorResult> {
    try {
      const apiKey = this.configService.get<string>('hadith.apiKey');
      const url = `https://hadithapi.com/api/hadiths?apiKey=${apiKey}&hadithEnglish=${encodeURIComponent(keyword)}`;
      const response = await axios.get<HadithSearchResponse>(url);
      const hadiths = response.data?.hadiths?.data ?? [];

      if (hadiths.length === 0) {
        return { found: false, message: `No hadith found for: ${keyword}` };
      }

      return hadiths.slice(0, 3).map((hadith) => ({
        reference: `${hadith.book?.bookName ?? collection} Hadith #${hadith.hadithNumber}`,
        narrator: hadith.englishNarrator,
        text: hadith.hadithEnglish,
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

