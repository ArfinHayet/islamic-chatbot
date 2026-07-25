/**
 * Prompt template for generating game scenarios via Gemini.
 * Uses JSON mode with a strict schema for structured output.
 */

export const VIRTUES = [
  'honesty',
  'patience',
  'generosity',
  'compassion',
  'justice',
  'humility',
] as const;

export type Virtue = (typeof VIRTUES)[number];

export const DISTRICTS = ['home', 'marketplace', 'madrasa'] as const;
export type District = (typeof DISTRICTS)[number];

const DISTRICT_SETTINGS: Record<District, string> = {
  home: 'a family home courtyard — scenes involve household dynamics, family relationships, neighborly interactions, and private moral choices',
  marketplace: 'a bustling marketplace/souk — scenes involve buying, selling, bargaining, business ethics, encounters with strangers, and public integrity',
  madrasa: 'a madrasa (school) courtyard — scenes involve learning, peer relationships, teacher interactions, academic honesty, and community knowledge sharing',
};

const DIFFICULTY_GUIDE: Record<number, string> = {
  1: 'Level 1 (Beginner): The moral direction should be fairly clear. One option is noticeably more virtuous, but the others are still plausible human reactions — never cartoonishly bad. The dilemma should be relatable and everyday.',
  2: 'Level 2 (Intermediate): The dilemma should involve competing goods — two options could both be considered virtuous for different reasons. The "best" choice requires weighing context and consequences.',
  3: 'Level 3 (Advanced): Maximum moral nuance. All three options should be defensible. There is no obviously "right" answer — the scenario tests mature ethical reasoning. The reflection should acknowledge the difficulty.',
};

export function buildScenarioPrompt(
  level: number,
  district: District,
  virtueFocus: Virtue,
): string {
  return [
    'You are a scenario writer for "Virtue Quest", an Islamic moral decision game for a general/family audience.',
    '',
    'TASK: Generate ONE scenario as a JSON object.',
    '',
    `SETTING: ${DISTRICT_SETTINGS[district]}`,
    `DIFFICULTY: ${DIFFICULTY_GUIDE[level] ?? DIFFICULTY_GUIDE[1]}`,
    `PRIMARY VIRTUE FOCUS: ${virtueFocus} (but the other options may touch other virtues)`,
    '',
    'RULES:',
    '1. The dilemma must be an EVERYDAY situation — not an overtly religious one. Religion should not be mentioned in the situation text.',
    '2. The REFLECTION (not the dilemma) carries the Islamic framing — brief, paraphrased wisdom grounded in general Islamic ethical principles.',
    '3. NEVER include verbatim Quran ayat or hadith text in reflections. Paraphrase the wisdom only.',
    '4. All 3 options must be PLAUSIBLE human responses. No strawman / cartoonishly bad option.',
    '5. Each option must be tagged with a primary virtue from this list: honesty, patience, generosity, compassion, justice, humility.',
    '6. Delta points: +1 (acceptable), +2 (good), +3 (exemplary) — distribute across the 3 options.',
    '7. CRITICAL LENGTH RULE: Situation text MUST be 1-2 SHORT SENTENCES MAX (12-20 words total). RPG dialogue style, clear and punchy.',
    '8. CRITICAL OPTION LENGTH RULE: Each option text MUST BE EXTREMELY SHORT — EXACTLY 3 TO 5 WORDS MAX (e.g. "Return money to neighbor", "Keep coins for yourself", "Donate coins to poor").',
    '9. Reflections MUST be 1 short sentence (8-15 words).',
    '10. The scenario must be appropriate for all ages — no violence, explicit content, or controversial topics.',
    '',
    'OUTPUT: Return a single JSON object with this exact shape:',
    '{',
    '  "situation": "string (2-4 sentences, second person, present tense)",',
    '  "options": [',
    '    {',
    '      "text": "string (the choice, 1-2 sentences)",',
    '      "virtue": "string (one of: honesty, patience, generosity, compassion, justice, humility)",',
    '      "delta": number (1-3),',
    '      "reflection": "string (≤ 2 sentences, Islamic ethical wisdom, no verbatim scripture)"',
    '    },',
    '    // exactly 3 options',
    '  ]',
    '}',
  ].join('\n');
}

/**
 * The JSON schema passed to Gemini's responseSchema parameter
 * to enforce structured output.
 */
export const SCENARIO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    situation: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          virtue: {
            type: 'string',
            enum: [...VIRTUES],
          },
          delta: { type: 'integer' },
          reflection: { type: 'string' },
        },
        required: ['text', 'virtue', 'delta', 'reflection'],
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['situation', 'options'],
};
