/**
 * Hadith Data Converter
 *
 * Downloads hadith collections from the fawazahmed0/hadith-api CDN
 * (https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1) and converts
 * them into the local hadiths.jsonl format used by seed-hadith.ts.
 *
 * Collections fetched: bukhari, muslim, abudawud, tirmidhi, ibnmajah, nasai
 *
 * Output: multilingual-hadith/hadiths.jsonl (relative to project root)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/convert-hadith.ts
 *
 * Requires internet access. No env vars needed.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '../../multilingual-hadith');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'hadiths.jsonl');

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';

const COLLECTIONS: Array<{ slug: string; name: string; enEdition: string; arEdition: string }> = [
  { slug: 'bukhari', name: 'Sahih Bukhari', enEdition: 'eng-bukhari', arEdition: 'ara-bukhari' },
  { slug: 'muslim', name: 'Sahih Muslim', enEdition: 'eng-muslim', arEdition: 'ara-muslim' },
  { slug: 'abudawud', name: 'Sunan Abu Dawud', enEdition: 'eng-abudawud', arEdition: 'ara-abudawud' },
  { slug: 'tirmidhi', name: 'Jami at-Tirmidhi', enEdition: 'eng-tirmidhi', arEdition: 'ara-tirmidhi' },
  { slug: 'ibnmajah', name: 'Sunan Ibn Majah', enEdition: 'eng-ibnmajah', arEdition: 'ara-ibnmajah' },
  { slug: 'nasai', name: "Sunan an-Nasa'i", enEdition: 'eng-nasai', arEdition: 'ara-nasai' },
];

interface FawazHadith {
  hadithnumber: number;
  text: string;
  grades?: Array<{ grade: string }>;
  reference?: { book?: number; hadith?: number };
}

interface FawazChapter {
  id: number;
  arabic?: string;
  english?: string;
}

interface FawazEdition {
  hadiths: FawazHadith[];
  chapters?: FawazChapter[];
  metadata?: { name?: string };
}

interface HadithJsonlRecord {
  id: string;
  collection: string;
  collection_name: string;
  hadith_number: number;
  chapter_number: number | null;
  chapter_name: string | null;
  text_ar: string;
  text_en: string | null;
  narrator_en: string | null;
  grade: string | null;
}

async function fetchEdition(edition: string): Promise<FawazEdition | null> {
  const url = `${CDN_BASE}/${edition}.json`;
  try {
    const res = await axios.get<FawazEdition>(url, { timeout: 60_000 });
    return res.data;
  } catch (err) {
    console.error(`  Failed to fetch ${url}: ${(err as Error).message}`);
    return null;
  }
}

function buildChapterMap(chapters?: FawazChapter[]): Map<number, string> {
  const map = new Map<number, string>();
  if (!chapters) return map;
  for (const ch of chapters) {
    const name = ch.english ?? ch.arabic ?? '';
    if (name) map.set(ch.id, name);
  }
  return map;
}

function inferChapterNumber(hadith: FawazHadith): number | null {
  if (hadith.reference?.book != null) return hadith.reference.book;
  return null;
}

function extractGrade(hadith: FawazHadith): string | null {
  if (!hadith.grades || hadith.grades.length === 0) return null;
  return hadith.grades[0].grade ?? null;
}

async function main(): Promise<void> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const out = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });
  let totalWritten = 0;

  for (const col of COLLECTIONS) {
    console.log(`\nProcessing collection: ${col.name} (${col.slug})`);

    console.log(`  Fetching English edition: ${col.enEdition} ...`);
    const enData = await fetchEdition(col.enEdition);

    console.log(`  Fetching Arabic edition: ${col.arEdition} ...`);
    const arData = await fetchEdition(col.arEdition);

    if (!enData && !arData) {
      console.warn(`  Skipping ${col.slug} — both editions failed to fetch`);
      continue;
    }

    // Build Arabic text map keyed by hadith number for fast lookup
    const arTextMap = new Map<number, string>();
    if (arData) {
      for (const h of arData.hadiths) {
        arTextMap.set(h.hadithnumber, h.text);
      }
    }

    const chapterMap = enData
      ? buildChapterMap(enData.chapters)
      : buildChapterMap(arData?.chapters);

    const hadiths = enData ? enData.hadiths : (arData?.hadiths ?? []);
    let colCount = 0;

    for (const h of hadiths) {
      const chapterNumber = inferChapterNumber(h);
      const chapterName = chapterNumber != null ? (chapterMap.get(chapterNumber) ?? null) : null;

      const record: HadithJsonlRecord = {
        id: `${col.slug}:${h.hadithnumber}`,
        collection: col.slug,
        collection_name: col.name,
        hadith_number: h.hadithnumber,
        chapter_number: chapterNumber,
        chapter_name: chapterName,
        text_ar: arTextMap.get(h.hadithnumber) ?? '',
        text_en: enData ? h.text : null,
        narrator_en: null, // fawazahmed0 dataset does not provide narrator separately
        grade: extractGrade(h),
      };

      out.write(JSON.stringify(record) + '\n');
      colCount++;
      totalWritten++;
    }

    console.log(`  Written ${colCount} hadiths for ${col.name}`);
  }

  out.end();
  console.log(`\nDone. Total hadiths written: ${totalWritten}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
