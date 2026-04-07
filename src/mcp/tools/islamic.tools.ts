export const ISLAMIC_TOOLS = [
  {
    name: 'search_quran_by_topic',
    description: `Search the Quran by topic or keyword using semantic search across all languages. ALWAYS use this tool when the user asks about any Quranic topic, verse, or teaching. NEVER pick surah/ayah from memory. Returns top matching verses with Arabic text and translation in the specified language.`,
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Topic or concept to search for, e.g. patience, prayer, forgiveness, justice. Use a keyword in any language — the search is cross-lingual.',
        },
        language: {
          type: 'string',
          description: 'Language code for the translation to return alongside the Arabic text. Detect from the user message. Supported: ar, bn, en, es, fr, id, ru, tr, zh. Default: en',
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
