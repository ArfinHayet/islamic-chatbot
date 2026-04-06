import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface QuranMatch {
  number: number;
  text: string;
  surah: {
    number: number;
    name: string;
    englishName: string;
  };
  numberInSurah: number;
}

interface QuranSearchResponse {
  data: {
    count: number;
    matches: QuranMatch[];
  };
}

interface HadithItem {
  hadithNumber: string | number;
  hadithEnglish: string;
  englishNarrator: string;
  book?: { bookName: string };
  bookSlug?: string;
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
  text: string;
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

  constructor(private readonly configService: ConfigService) {}

  async executeTool(toolName: string, toolInput: Record<string, string>): Promise<ToolResult> {
    switch (toolName) {
      case 'search_quran_by_topic':
        return this.searchQuranByTopic(toolInput.keyword, toolInput.translation);
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
    translation = 'en.sahih',
  ): Promise<QuranResult[] | NotFoundResult | ErrorResult> {
    try {
      const url = `https://api.alquran.cloud/v1/search/${encodeURIComponent(keyword)}/all/${translation}`;
      const response = await axios.get<QuranSearchResponse>(url);
      const matches = response.data?.data?.matches ?? [];

      if (matches.length === 0) {
        return { found: false, message: `No verses found for: ${keyword}` };
      }

      return matches.slice(0, 3).map((match) => ({
        reference: `Surah ${match.surah.englishName} (${match.surah.number}:${match.numberInSurah})`,
        arabicName: match.surah.name,
        text: match.text,
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
      const url = `https://hadithapi.com/api/hadiths/?apiKey=${apiKey}&book=${collection}&paginate=3&keyword=${encodeURIComponent(keyword)}`;
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
      this.logger.warn(`Prayer times lookup failed for ${city}, ${country}: ${(error as Error).message}`);
      return { error: `Failed to get prayer times: ${(error as Error).message}` };
    }
  }
}
