/**
 * Keyword-based content safety filter for LLM-generated game scenarios.
 * Checks situation text, option texts, and reflections against a blocklist
 * of explicit, violent, controversial, or sectarian terms.
 */

const BLOCKED_TERMS: string[] = [
  // Violence / gore
  'kill', 'murder', 'blood', 'gore', 'torture', 'stab', 'shoot', 'weapon',
  'bomb', 'explode', 'suicide', 'terrorist', 'attack', 'assault', 'abuse',
  'beating', 'massacre', 'slaughter',
  // Sexual content
  'sexual', 'nude', 'pornograph', 'explicit', 'erotic', 'intimat',
  // Sectarian / divisive
  'kafir', 'infidel', 'apostate', 'murtad', 'heretic', 'deviant sect',
  'bid\'ah', 'shirk', 'wahabi', 'salafi', 'sufi', 'shia', 'sunni',
  // Drugs / alcohol
  'alcohol', 'drunk', 'cocaine', 'heroin', 'drug dealer', 'narcotic',
  // Profanity
  'damn', 'hell', 'bastard',
  // Political extremism
  'jihadi', 'caliphate', 'extremis', 'radical',
  // Self-harm
  'self-harm', 'cut yourself', 'end your life',
];

const BLOCKED_REGEX = new RegExp(
  BLOCKED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
}

export function checkScenarioSafety(scenario: {
  situation: string;
  options: { text: string; reflection: string }[];
}): SafetyCheckResult {
  // Check situation text
  const situationMatch = BLOCKED_REGEX.exec(scenario.situation);
  if (situationMatch) {
    return {
      safe: false,
      reason: `Blocked term "${situationMatch[0]}" found in situation text`,
    };
  }

  // Check all option texts and reflections
  for (let i = 0; i < scenario.options.length; i++) {
    const option = scenario.options[i];

    const textMatch = BLOCKED_REGEX.exec(option.text);
    if (textMatch) {
      return {
        safe: false,
        reason: `Blocked term "${textMatch[0]}" found in option ${i + 1} text`,
      };
    }

    const reflectionMatch = BLOCKED_REGEX.exec(option.reflection);
    if (reflectionMatch) {
      return {
        safe: false,
        reason: `Blocked term "${reflectionMatch[0]}" found in option ${i + 1} reflection`,
      };
    }
  }

  return { safe: true };
}
