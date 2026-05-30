import type { SessionForAnalytics } from "@/app/lib/analytics";

type AiContext = {
  analytics: ReturnType<typeof import("@/app/lib/analytics").calculateAnalytics>;
  sessions: SessionForAnalytics[];
};

export type AiProfileResult = {
  profile: {
    bestFocusDuration: number;
    optimalBreakDuration: number;
    peakHours: string;
    focusStability: number;
    summary: string;
  };
  recommendations: {
    title: string;
    description: string;
    type:
      | "FOCUS_DURATION"
      | "BREAK_DURATION"
      | "PRODUCTIVITY_TIME"
      | "DISTRACTION_REDUCTION"
      | "GENERAL";
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["profile", "recommendations"],
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      required: [
        "bestFocusDuration",
        "optimalBreakDuration",
        "peakHours",
        "focusStability",
        "summary",
      ],
      properties: {
        bestFocusDuration: { type: "integer" },
        optimalBreakDuration: { type: "integer" },
        peakHours: { type: "string" },
        focusStability: { type: "integer" },
        summary: { type: "string" },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "type", "priority"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          type: {
            type: "string",
            enum: [
              "FOCUS_DURATION",
              "BREAK_DURATION",
              "PRODUCTIVITY_TIME",
              "DISTRACTION_REDUCTION",
              "GENERAL",
            ],
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
          },
        },
      },
    },
  },
};

export function buildPromptSnapshot(context: AiContext) {
  const compactSessions = context.sessions.slice(0, 20).map((session) => ({
    mode: session.mode,
    focusDuration: session.focusDuration,
    breakDuration: session.breakDuration,
    plannedCycles: session.plannedCycles,
    completedCycles: session.completedCycles,
    duration: session.duration,
    interruptions: session.interruptions,
    productivityScore: session.productivityScore,
    startHour: session.startTime.getHours(),
  }));

  return [
    "Ты AI-модуль учебного веб-приложения AI Productivity Tracker.",
    "Проанализируй метрики фокус-сессий пользователя и верни JSON по заданной схеме.",
    "Все значения строк должны быть только на русском языке. Не используй английские слова вроде focus, breaks, distractions, productivity, stay.",
    "Не принимай решения вместо пользователя: формулируй рекомендации как мягкие советы.",
    "Текст должен быть на русском языке, понятный студенту или специалисту.",
    "profile.peakHours всегда должен быть строкой в формате HH:00-HH:00, например 18:00-19:00. Не возвращай массив.",
    "Сформируй 4-5 рекомендаций. Используй только типы и приоритеты из схемы.",
    "",
    "Агрегированная аналитика:",
    JSON.stringify(context.analytics, null, 2),
    "",
    "Последние фокус-сессии:",
    JSON.stringify(compactSessions, null, 2),
  ].join("\n");
}

function formatHourRangeFromValue(value: unknown) {
  if (typeof value === "string") {
    const rangeMatch = value.match(/(\d{1,2})(?::00)?\D+(\d{1,2})(?::00)?/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (Number.isInteger(start) && Number.isInteger(end)) {
        return `${String(start).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00`;
      }
    }

    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    const start = Number(value[0]);

    if (Number.isInteger(start)) {
      const end = (start + 1) % 24;
      return `${String(start).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00`;
    }
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    const end = (value + 1) % 24;
    return `${String(value).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00`;
  }

  return "нет данных";
}

function normalizeRussianText(value: string) {
  return value
    .replace(/\bbreaks?\b/gi, "перерывы")
    .replace(/\bfocus\b/gi, "фокус")
    .replace(/\bdistractions?\b/gi, "прерывания")
    .replace(/\bproductivity\b/gi, "продуктивность")
    .replace(/\bstay\b/gi, "оставаться")
    .replace(/\brejuvenation\b/gi, "восстановления");
}

function addProductivityPercents(value: string) {
  return value.replace(
    /(показател[ья] продуктивности(?: за сессию)?\s*[-–]\s*)(\d{1,3})(?!\s*[%\d])/gi,
    "$1$2%"
  );
}

function normalizeAiResult(result: AiProfileResult): AiProfileResult {
  return {
    profile: {
      ...result.profile,
      peakHours: formatHourRangeFromValue(result.profile.peakHours),
      summary: addProductivityPercents(normalizeRussianText(result.profile.summary)),
    },
    recommendations: result.recommendations.map((recommendation) => ({
      ...recommendation,
      title: normalizeRussianText(recommendation.title),
      description: normalizeRussianText(recommendation.description),
    })),
  };
}

function extractResponseText(data: unknown) {
  if (typeof data !== "object" || data === null) return null;

  const record = data as { output_text?: unknown; output?: unknown };

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (!Array.isArray(record.output)) {
    return null;
  }

  const chunks: string[] = [];

  record.output.forEach((item) => {
    if (typeof item !== "object" || item === null) return;

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return;

    content.forEach((part) => {
      if (typeof part !== "object" || part === null) return;

      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        chunks.push(text);
      }
    });
  });

  return chunks.length > 0 ? chunks.join("\n") : null;
}

async function generateOpenAiProfile(context: AiContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const promptSnapshot = buildPromptSnapshot(context);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: promptSnapshot,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "focus_profile_result",
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "OpenAI API request failed";

    throw new Error(message);
  }

  const text = extractResponseText(data);

  if (!text) {
    throw new Error("OpenAI response did not include text output");
  }

  return {
    provider: "openai",
    model,
    promptSnapshot,
    result: normalizeAiResult(JSON.parse(text) as AiProfileResult),
  };
}

function normalizeOllamaUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function generateOllamaProfile(context: AiContext) {
  const baseUrl = normalizeOllamaUrl(
    process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  );
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const promptSnapshot = buildPromptSnapshot(context);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: promptSnapshot,
      stream: false,
      format: responseSchema,
      options: {
        temperature: 0.2,
      },
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : "Ollama API request failed";

    throw new Error(message);
  }

  if (typeof data?.response !== "string") {
    throw new Error("Ollama response did not include JSON text");
  }

  return {
    provider: "ollama",
    model,
    promptSnapshot,
    result: normalizeAiResult(JSON.parse(data.response) as AiProfileResult),
  };
}

export async function generateAiProfile(context: AiContext) {
  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

  if (provider === "disabled") {
    throw new Error("AI_PROVIDER is disabled");
  }

  if (provider === "openai") {
    return generateOpenAiProfile(context);
  }

  return generateOllamaProfile(context);
}
