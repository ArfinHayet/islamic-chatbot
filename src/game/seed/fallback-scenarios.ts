import { ScenarioOption } from '../entities/scenario-bank.entity';

export interface SeedScenario {
  level: number;
  district: string;
  locale: string;
  situation: string;
  options: ScenarioOption[];
}

export const FALLBACK_SCENARIOS: SeedScenario[] = [
  {
    level: 1,
    district: 'home',
    locale: 'en',
    situation: 'You find a lost pouch of gold coins near your neighbor\'s doorstep.',
    options: [
      {
        text: 'Return money to neighbor',
        virtue: 'honesty',
        delta: 3,
        reflection: 'Returning lost goods reflects pure inner integrity.'
      },
      {
        text: 'Keep coins for yourself',
        virtue: 'patience',
        delta: 1,
        reflection: 'Selfishness weakens a person\'s moral character.'
      },
      {
        text: 'Donate coins to poor',
        virtue: 'generosity',
        delta: 2,
        reflection: 'Charity is noble, but must come from owned property.'
      }
    ]
  },
  {
    level: 1,
    district: 'home',
    locale: 'en',
    situation: 'Your elderly neighbor struggles with heavy grocery bags on the stairs.',
    options: [
      {
        text: 'Carry bags for neighbor',
        virtue: 'compassion',
        delta: 3,
        reflection: 'Helping the elderly brings great grace to your day.'
      },
      {
        text: 'Carry one bag quickly',
        virtue: 'justice',
        delta: 2,
        reflection: 'Doing what you can balances duty and kindness.'
      },
      {
        text: 'Suggest calling building helper',
        virtue: 'patience',
        delta: 1,
        reflection: 'Direct personal assistance creates true warmth.'
      }
    ]
  },
  {
    level: 1,
    district: 'marketplace',
    locale: 'en',
    situation: 'A busy fruit vendor accidentally gives you double the change owed.',
    options: [
      {
        text: 'Return extra change instantly',
        virtue: 'honesty',
        delta: 3,
        reflection: 'Fairness in trade builds an trustworthy heart.'
      },
      {
        text: 'Warn merchant about mistake',
        virtue: 'generosity',
        delta: 2,
        reflection: 'Protecting a merchant\'s income is quiet kindness.'
      },
      {
        text: 'Pocket the extra coins',
        virtue: 'justice',
        delta: 1,
        reflection: 'Taking unearned change breaks market trust.'
      }
    ]
  },
  {
    level: 1,
    district: 'marketplace',
    locale: 'en',
    situation: 'A shopkeeper overcharges a tourist three times the normal price.',
    options: [
      {
        text: 'Tell tourist fair price',
        virtue: 'justice',
        delta: 3,
        reflection: 'Protecting strangers from deceit upholds community honour.'
      },
      {
        text: 'Advise shopkeeper in private',
        virtue: 'humility',
        delta: 2,
        reflection: 'Private advice corrects wrong without public shame.'
      },
      {
        text: 'Ignore the transaction completely',
        virtue: 'patience',
        delta: 1,
        reflection: 'Ignoring fraud makes us silent partners in deceit.'
      }
    ]
  },
  {
    level: 1,
    district: 'madrasa',
    locale: 'en',
    situation: 'A classmate is struggling to understand tomorrow\'s exam lesson.',
    options: [
      {
        text: 'Explain lesson for twenty minutes',
        virtue: 'generosity',
        delta: 3,
        reflection: 'Teaching peers deepens knowledge and brings blessings.'
      },
      {
        text: 'Lend your study notes',
        virtue: 'compassion',
        delta: 2,
        reflection: 'Sharing study tools is a practical gift of care.'
      },
      {
        text: 'Direct them to teacher',
        virtue: 'honesty',
        delta: 1,
        reflection: 'Personal tutoring builds stronger bonds than referrals.'
      }
    ]
  },
  {
    level: 2,
    district: 'home',
    locale: 'en',
    situation: 'Your sibling broke a family vase and begs you to hide it.',
    options: [
      {
        text: 'Encourage sibling to confess',
        virtue: 'patience',
        delta: 3,
        reflection: 'Facing mistakes bravely builds true courage.'
      },
      {
        text: 'Help repair vase secretly',
        virtue: 'compassion',
        delta: 2,
        reflection: 'Love should encourage truth rather than conceal faults.'
      },
      {
        text: 'Tell parents what happened',
        virtue: 'honesty',
        delta: 2,
        reflection: 'Truth is essential, but self-confession is better.'
      }
    ]
  },
  {
    level: 2,
    district: 'home',
    locale: 'en',
    situation: 'A relative takes full credit for your shared community project.',
    options: [
      {
        text: 'Mention your joint effort',
        virtue: 'justice',
        delta: 3,
        reflection: 'Gentle truth restores credit while keeping peace.'
      },
      {
        text: 'Stay silent during dinner',
        virtue: 'humility',
        delta: 2,
        reflection: 'Yielding credit for family unity shows humility.'
      },
      {
        text: 'Discuss credit in private',
        virtue: 'honesty',
        delta: 2,
        reflection: 'Private conversation prevents unnecessary family friction.'
      }
    ]
  },
  {
    level: 2,
    district: 'marketplace',
    locale: 'en',
    situation: 'A poor merchant gives you a towel with a tiny loose thread.',
    options: [
      {
        text: 'Accept item without complaint',
        virtue: 'generosity',
        delta: 3,
        reflection: 'Overlooking small flaws aids struggling traders.'
      },
      {
        text: 'Politely inform about defect',
        virtue: 'honesty',
        delta: 2,
        reflection: 'Kindly feedback helps merchants improve quality.'
      },
      {
        text: 'Request slight price discount',
        virtue: 'justice',
        delta: 2,
        reflection: 'Fair pricing is reasonable when asked politely.'
      }
    ]
  },
  {
    level: 2,
    district: 'madrasa',
    locale: 'en',
    situation: 'A student confidently states false history facts in group study.',
    options: [
      {
        text: 'Ask helpful guiding question',
        virtue: 'compassion',
        delta: 3,
        reflection: 'Guiding peers without embarrassment shows true wisdom.'
      },
      {
        text: 'State correct historical fact',
        virtue: 'justice',
        delta: 2,
        reflection: 'Correcting facts preserves academic integrity.'
      },
      {
        text: 'Tell them after class',
        virtue: 'humility',
        delta: 2,
        reflection: 'Private correction respects your peer\'s dignity.'
      }
    ]
  },
  {
    level: 2,
    district: 'madrasa',
    locale: 'en',
    situation: 'You are assigned a team project with a lazy classmate.',
    options: [
      {
        text: 'Set clear task divisions',
        virtue: 'justice',
        delta: 3,
        reflection: 'Clear task splitting promotes team accountability.'
      },
      {
        text: 'Work side-by-side with them',
        virtue: 'compassion',
        delta: 2,
        reflection: 'Direct teamwork encourages lazy partners to contribute.'
      },
      {
        text: 'Complete all work alone',
        virtue: 'patience',
        delta: 1,
        reflection: 'Doing all work alone hinders partner growth.'
      }
    ]
  },
  {
    level: 3,
    district: 'home',
    locale: 'en',
    situation: 'An elder asks your advice on a very risky investment.',
    options: [
      {
        text: 'Share financial risks calmly',
        virtue: 'honesty',
        delta: 3,
        reflection: 'Sincere advice is a key duty of love.'
      },
      {
        text: 'Ask thoughtful cautious questions',
        virtue: 'humility',
        delta: 2,
        reflection: 'Asking questions guides elders with respect.'
      },
      {
        text: 'Agree with their plan',
        virtue: 'patience',
        delta: 1,
        reflection: 'Blind agreement to bad plans is unwise.'
      }
    ]
  },
  {
    level: 3,
    district: 'marketplace',
    locale: 'en',
    situation: 'A rival merchant spreads false rumors about your goods.',
    options: [
      {
        text: 'Let honest work speak',
        virtue: 'patience',
        delta: 3,
        reflection: 'Patience and quality outshine false rumors.'
      },
      {
        text: 'Confront rival in private',
        virtue: 'honesty',
        delta: 3,
        reflection: 'Direct private talk resolves conflict cleanly.'
      },
      {
        text: 'Spread true rival facts',
        virtue: 'justice',
        delta: 1,
        reflection: 'Retaliating with gossip prolongs bitter disputes.'
      }
    ]
  },
  {
    level: 3,
    district: 'marketplace',
    locale: 'en',
    situation: 'A customer in hardship requests an unpayable large discount.',
    options: [
      {
        text: 'Offer fair moderate discount',
        virtue: 'humility',
        delta: 3,
        reflection: 'Balanced kindness sustains both business and care.'
      },
      {
        text: 'Grant full requested discount',
        virtue: 'generosity',
        delta: 2,
        reflection: 'Sacrificing profit for neighbors in need is noble.'
      },
      {
        text: 'Offer monthly payment plan',
        virtue: 'justice',
        delta: 2,
        reflection: 'Instalment plans offer practical help fairly.'
      }
    ]
  },
  {
    level: 3,
    district: 'madrasa',
    locale: 'en',
    situation: 'A mentor gives subtle favors to wealthy students only.',
    options: [
      {
        text: 'Discuss bias with mentor',
        virtue: 'honesty',
        delta: 3,
        reflection: 'Respectful feedback to mentors protects fairness.'
      },
      {
        text: 'Tutor overlooked students directly',
        virtue: 'compassion',
        delta: 2,
        reflection: 'Personal tutoring heals gaps caused by unfairness.'
      },
      {
        text: 'Report to school council',
        virtue: 'justice',
        delta: 2,
        reflection: 'Formal reports maintain institutional order.'
      }
    ]
  },
  {
    level: 3,
    district: 'madrasa',
    locale: 'en',
    situation: 'You catch a desperate peer using a cheat sheet during exam.',
    options: [
      {
        text: 'Urge peer to confess',
        virtue: 'generosity',
        delta: 3,
        reflection: 'Encouraging self-confession offers true mercy.'
      },
      {
        text: 'Signal peer to stop',
        virtue: 'compassion',
        delta: 2,
        reflection: 'Silent warnings give a chance to correct wrongdoing.'
      },
      {
        text: 'Report cheating to supervisor',
        virtue: 'justice',
        delta: 2,
        reflection: 'Upholding test rules ensures fairness for everyone.'
      }
    ]
  }
];
