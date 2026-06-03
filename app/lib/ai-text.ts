const phraseReplacements: [RegExp, string][] = [
  [
    /[sс][uу][mм]{1,2}[aа][rр][iіи][zз][eе]\s+(?:your|ваши|свои)?\s*(?:focus|фокус)[-\s]?(?:sessions?|сесс(?:ии|ий)?)\s+(?:to|чтобы)\s+(?:optimi[sz]e|улучшить|повысить)\s+(?:productivity|продуктивность)\.?/giu,
    "Подведите итог фокус-сессий, чтобы повысить продуктивность.",
  ],
  [
    /Summarize\s+(?:your\s+)?focus\s+sessions?\s+to\s+optimi[sz]e\s+productivity\.?/gi,
    "Подведите итог фокус-сессий, чтобы повысить продуктивность.",
  ],
  [
    /Summarize\s+(?:your\s+)?фокус\s+sessions?\s+to\s+optimi[sz]e\s+продуктивность\.?/gi,
    "Подведите итог фокус-сессий, чтобы повысить продуктивность.",
  ],
  [
    /(?:Summarize|[СC]уммар(?:ize|айз|изируйте|изируй|изировать))\s+(?:your|ваши|свои)?\s*фокус[-\s]?сесс(?:ии|ий|ions?)?\s+(?:to|чтобы)\s+(?:optimi[sz]e|улучшить|повысить)\s+продуктивность\.?/gi,
    "Подведите итог фокус-сессий, чтобы повысить продуктивность.",
  ],
  [
    /(?:Summarize|[sс][uу][mм]{1,2}[aа][rр][iіи][zз][eе]|[СC]уммар(?:ize|айз|изируйте|изируй|изировать))\s+(?:your|ваши|свои)?\s*фокус[-\s]?сесс(?:ии|ий|ions?)?/giu,
    "Подведите итог фокус-сессий",
  ],
  [/Напишите\s+в\s+journal/gi, "Ведите дневник"],
  [/Use\s+notifications?/gi, "Используйте уведомления"],
];

const wordReplacements: [RegExp, string][] = [
  [/\bjournal\b/gi, "дневник"],
  [/\bdiary\b/gi, "дневник"],
  [/\bsessions?\b/gi, "сессии"],
  [/\boptimi[sz]e\b/gi, "повысить"],
  [/\bimprove\b/gi, "улучшить"],
  [/\bfocus\b/gi, "фокус"],
  [/\bbreaks?\b/gi, "перерывы"],
  [/\bdistractions?\b/gi, "отвлечения"],
  [/\bproductivity\b/gi, "продуктивность"],
  [/\bstay\b/gi, "оставаться"],
  [/\btracking\b/gi, "отслеживание"],
  [/\btrack\b/gi, "отслеживать"],
  [/\bmonitor\b/gi, "отслеживать"],
  [/\bapp(?:lication)?\b/gi, "приложение"],
  [/\brejuvenation\b/gi, "восстановление"],
  [/\brestore\b/gi, "восстановить"],
  [/\bschedule\b/gi, "график"],
  [/\bpriorities\b/gi, "приоритеты"],
  [/\bpriority\b/gi, "приоритет"],
  [/\bnotifications?\b/gi, "уведомления"],
  [/\btime\b/gi, "время"],
  [/\bwork\b/gi, "работа"],
  [/\brest\b/gi, "отдых"],
  [/\bcycles?\b/gi, "циклы"],
  [/\bscore\b/gi, "показатель"],
  [/\byour\b/gi, "ваши"],
  [/\bto\b/gi, "чтобы"],
  [/\bfor\b/gi, "для"],
  [/\band\b/gi, "и"],
  [/\bor\b/gi, "или"],
  [/\bin\b/gi, "в"],
];

const cleanupReplacements: [RegExp, string][] = [
  [/[sс][uу][mм]{1,2}[aа][rр][iіи][zз][eе]/giu, "Подведите итог"],
  [/[СC]уммар(?:ize|айз|изируйте|изируй|изировать)/gi, "Подведите итог"],
  [/Summarize\s+ваши\s+фокус-сессии,?\s+чтобы\s+повысить\s+продуктивность\.?/gi, "Подведите итог фокус-сессий, чтобы повысить продуктивность."],
  [/Подведите итог ваши фокус-сессии чтобы повысить продуктивность\.?/gi, "Подведите итог фокус-сессий, чтобы повысить продуктивность."],
  [/Подведите итог фокус-сессии чтобы повысить продуктивность\.?/gi, "Подведите итог фокус-сессий, чтобы повысить продуктивность."],
  [/фокус\s+сессии/gi, "фокус-сессии"],
  [/фокус\s+сессий/gi, "фокус-сессий"],
  [/фокус-сессии чтобы/gi, "фокус-сессии, чтобы"],
  [/вам\s*оставаться/gi, "вам оставаться"],
  [/уведомления или приложение для отслеживание/gi, "уведомления или приложение для отслеживания"],
  [/отслеживания отвлечения/gi, "отслеживания отвлечений"],
];

export function normalizeAiText(value: string) {
  let normalized = value;

  phraseReplacements.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  wordReplacements.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  cleanupReplacements.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized.replace(/\s+/g, " ").trim();
}

export function normalizeAiProfileSummary<T extends { summary: string | null }>(
  profile: T
) {
  return {
    ...profile,
    summary: profile.summary ? normalizeAiText(profile.summary) : profile.summary,
  };
}

export function normalizeAiRecommendation<
  T extends { title: string; description: string },
>(recommendation: T) {
  return {
    ...recommendation,
    title: normalizeAiText(recommendation.title),
    description: normalizeAiText(recommendation.description),
  };
}
