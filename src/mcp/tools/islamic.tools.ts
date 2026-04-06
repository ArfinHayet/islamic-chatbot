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
