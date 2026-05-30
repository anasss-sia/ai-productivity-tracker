"use client";

import { TopNav } from "@/app/components/TopNav";
import { getStoredToken } from "@/app/lib/browser-storage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ChartPoint = {
  date: string;
  minutes: number;
};

type CyclePoint = {
  id: number;
  date: string;
  plannedCycles: number;
  completedCycles: number;
  completionRate: number;
};

type HourPoint = {
  hour: number;
  label: string;
  sessions: number;
  minutes: number;
  score: number;
};

type FocusProfile = {
  id: number;
  bestFocusDuration: number | null;
  optimalBreakDuration: number | null;
  peakHours: string | null;
  focusStability: number | null;
  summary: string | null;
  profileVersion: number;
};

type Recommendation = {
  id: number;
  title: string;
  description: string;
  type: string;
  priority: string;
};

type Analytics = {
  totalSessions: number;
  completedSessions: number;
  totalFocusMinutes: number;
  averageFocusDuration: number;
  averageInterruptions: number;
  totalInterruptions: number;
  totalPlannedCycles: number;
  totalCompletedCycles: number;
  completionRate: number;
  averageProductivityScore: number;
  focusStability: number;
  bestFocusTimeRange: string | null;
  charts: {
    dailyFocus: ChartPoint[];
    cycleCompletion: CyclePoint[];
    hourlyProductivity: HourPoint[];
  };
  focusProfile: FocusProfile | null;
  recommendations: Recommendation[];
};

type AiResult = {
  message: string;
  profile: FocusProfile;
  recommendations: Recommendation[];
};

function getToken() {
  return getStoredToken();
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function priorityLabel(priority: string) {
  if (priority === "HIGH") return "Высокий";
  if (priority === "LOW") return "Низкий";
  return "Средний";
}

function priorityClassName(priority: string) {
  if (priority === "HIGH") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (priority === "LOW") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  return "bg-orange-50 text-orange-700 border-orange-200";
}

const chartColors = {
  axis: "#3E3630",
  fill: "#C7D3DB",
  fillLight: "#E0E3ED",
  fillDark: "#A79A8A",
  track: "#F8F8F8",
};

const chartFills = [
  chartColors.fill,
  chartColors.fillDark,
  "#B2B4B7",
  chartColors.fillLight,
];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-44 w-full items-center justify-center rounded-xl bg-cool text-sm text-muted">
      Недостаточно данных
    </div>
  );
}

function CapsuleBar({
  value,
  max,
  color,
  title,
}: {
  value: number;
  max: number;
  color: string;
  title: string;
}) {
  const height = Math.max((value / max) * 100, value > 0 ? 14 : 0);

  return (
    <div
      className="relative flex h-40 w-full max-w-10 items-end overflow-hidden rounded-full shadow-inner"
      style={{ backgroundColor: chartColors.track }}
      title={title}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-full"
        style={{
          height: `${height}%`,
          backgroundColor: color,
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-2 rounded-full opacity-60"
        style={{
          height: `${height}%`,
          backgroundColor: chartColors.axis,
        }}
      />
    </div>
  );
}

function BarChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.minutes), 1);

  return (
    <div className="mt-5 rounded-xl bg-cool p-4">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-52 items-end gap-3 border-b-2 pb-2" style={{ borderColor: chartColors.axis }}>
          {data.map((item, index) => (
            <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
              <CapsuleBar
                value={item.minutes}
                max={max}
                color={chartFills[index % chartFills.length]}
                title={`${item.minutes} мин`}
              />
              <span className="text-xs font-medium text-muted">
                {formatDate(item.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CycleChart({ data }: { data: CyclePoint[] }) {
  const chartData = data.slice(-8);

  return (
    <div className="mt-5 rounded-xl bg-cool p-4">
      {chartData.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-52 items-end gap-3 border-b-2 pb-2" style={{ borderColor: chartColors.axis }}>
          {chartData.map((item, index) => (
            <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
              <CapsuleBar
                value={Math.min(Math.max(item.completionRate, 0), 100)}
                max={100}
                color={chartFills[index % chartFills.length]}
                title={`${item.completedCycles}/${item.plannedCycles} циклов`}
              />
              <span className="text-xs font-medium text-muted">
                {item.completedCycles}/{item.plannedCycles}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HourChart({ data }: { data: HourPoint[] }) {
  const activeHours = data.filter((item) => item.sessions > 0);
  const max = Math.max(...activeHours.map((item) => item.score), 1);

  return (
    <div className="mt-5 rounded-xl bg-cool p-4">
      {activeHours.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="grid h-52 grid-cols-[2rem_1fr] gap-3">
          <div className="flex flex-col justify-between pb-8 text-xs text-border">
            <span>{max}</span>
            <span>{Math.round(max / 2)}</span>
            <span>0</span>
          </div>

          <div className="flex items-end gap-3 border-b-2 pb-2" style={{ borderColor: chartColors.axis }}>
            {activeHours.map((item, index) => (
              <div key={item.hour} className="flex flex-1 flex-col items-center gap-2">
                <CapsuleBar
                  value={item.score}
                  max={max}
                  color={chartFills[index % chartFills.length]}
                  title={`${item.score} баллов`}
                />
                <span className="text-xs font-medium text-muted">
                  {item.label.slice(0, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniGauge({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="relative size-28 rounded-full bg-cool">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${chartColors.fillDark} ${
            safeValue * 3.6
          }deg, ${chartColors.track} 0deg)`,
        }}
      />
      <div className="absolute inset-3 flex items-center justify-center rounded-full bg-surface">
        <span className="text-xl font-bold text-foreground">{safeValue}%</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [message, setMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const activeProfile = aiResult?.profile ?? analytics?.focusProfile ?? null;
  const activeRecommendations = useMemo(
    () => aiResult?.recommendations ?? analytics?.recommendations ?? [],
    [aiResult, analytics]
  );

  const loadAnalytics = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/analytics", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ошибка загрузки аналитики");
      return;
    }

    setAnalytics(data);
  }, [router]);

  async function generateRecommendations() {
    setIsGenerating(true);
    setAiMessage("");
    setAiResult(null);

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/ai-recommendations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setAiMessage(data.error || "Ошибка генерации рекомендаций");
      setIsGenerating(false);
      return;
    }

    setAiResult(data);
    setAiMessage(data.message || "AI-рекомендации сгенерированы");
    setIsGenerating(false);

    await loadAnalytics();
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAnalytics();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadAnalytics]);

  return (
    <main className="min-h-screen bg-background">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-8 rounded-2xl border border-border bg-foreground p-7 text-background shadow-sm">
          <p className="text-sm font-medium text-accent">Аналитика и фокус-профиль</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold sm:text-5xl">Аналитика</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-accent">
                Основные показатели продуктивности, графики фокус-времени и
                персональные AI-рекомендации по нажатию кнопки.
              </p>
            </div>

            {analytics && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Фокус", `${analytics.totalFocusMinutes} мин`],
                  ["Циклы", `${Math.round(analytics.completionRate)}%`],
                  ["Сессии", analytics.completedSessions],
                  ["Лучшее время", analytics.bestFocusTimeRange ?? "нет данных"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-background/15 bg-background/10 p-4"
                  >
                    <p className="text-xs text-accent">{label}</p>
                    <p className="mt-2 text-xl font-bold text-background">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        {!analytics ? (
          <div className="rounded-lg border border-border bg-surface p-10 text-center text-muted shadow-sm">
            Загрузка аналитики...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Всего сессий", analytics.totalSessions, ""],
                ["Завершённых сессий", analytics.completedSessions, ""],
                ["Минут фокуса", analytics.totalFocusMinutes, "мин"],
                ["Средняя сессия", analytics.averageFocusDuration, "мин"],
              ].map(([label, value, unit]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-3 text-4xl font-bold text-foreground">{value}</p>
                  {unit && <p className="mt-1 text-sm text-muted">{unit}</p>}
                </div>
              ))}
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <p className="text-sm text-muted">Завершение циклов</p>
                <p className="mt-3 text-4xl font-bold text-foreground">
                  {Math.round(analytics.completionRate)}%
                </p>
                <p className="mt-2 text-sm text-muted">
                  {analytics.totalCompletedCycles} из {analytics.totalPlannedCycles}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <p className="text-sm text-muted">Средние прерывания</p>
                <p className="mt-3 text-4xl font-bold text-foreground">
                  {analytics.averageInterruptions}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Всего: {analytics.totalInterruptions}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div>
                  <p className="text-sm text-muted">Лучшее время дня</p>
                  <p className="mt-3 text-3xl font-bold text-foreground">
                    {analytics.bestFocusTimeRange ?? "нет данных"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Средняя продуктивность: {analytics.averageProductivityScore}%
                  </p>
                </div>
                <MiniGauge value={analytics.averageProductivityScore} />
              </div>
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">
                  Фокус-время по дням
                </h2>
                <BarChart data={analytics.charts.dailyFocus} />
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">
                  Завершение циклов
                </h2>
                <CycleChart data={analytics.charts.cycleCompletion} />
              </div>

              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">
                  Продуктивность по часам
                </h2>
                <HourChart data={analytics.charts.hourlyProductivity} />
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Индивидуальный фокус-профиль
                  </h2>
                  <p className="mt-2 max-w-2xl text-muted">
                    Для первичного профиля нужно минимум 3 завершённые
                    фокус-сессии. Генерация запускается вручную.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={generateRecommendations}
                  disabled={isGenerating}
                  className="rounded-lg bg-foreground px-5 py-3 font-medium text-background disabled:bg-border"
                >
                  {isGenerating ? "Генерация..." : "Сгенерировать рекомендации"}
                </button>
              </div>

              {aiMessage && (
                <div
                  className={`mt-5 rounded-lg border p-4 ${
                    aiResult
                      ? "border-border bg-background text-muted"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {aiMessage}
                </div>
              )}

              {activeProfile ? (
                <div className="mt-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xl font-bold text-foreground">
                      Фокус-профиль
                    </h3>
                    <span className="rounded-lg bg-cool px-3 py-1 text-sm text-muted">
                      Версия {activeProfile.profileVersion}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    {[
                      ["Оптимальный фокус", activeProfile.bestFocusDuration ?? 0, "мин"],
                      ["Оптимальный перерыв", activeProfile.optimalBreakDuration ?? 0, "мин"],
                      ["Лучшее время", activeProfile.peakHours ?? "нет данных", ""],
                      ["Стабильность", activeProfile.focusStability ?? 0, "%"],
                    ].map(([label, value, unit]) => (
                      <div key={label} className="rounded-lg bg-background p-4">
                        <p className="text-sm text-muted">{label}</p>
                        <p className="mt-2 text-2xl font-bold text-foreground">
                          {value}
                        </p>
                        {unit && <p className="text-sm text-muted">{unit}</p>}
                      </div>
                    ))}
                  </div>

                  {activeProfile.summary && (
                    <p className="mt-5 leading-7 text-muted">
                      {activeProfile.summary}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-lg bg-background p-5 text-muted">
                  Фокус-профиль ещё не сформирован.
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-xl font-bold text-foreground">AI-рекомендации</h3>

                {activeRecommendations.length === 0 ? (
                  <div className="mt-4 rounded-lg bg-background p-5 text-muted">
                    Активных рекомендаций пока нет.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {activeRecommendations.map((recommendation) => (
                      <article
                        key={recommendation.id}
                        className="rounded-lg border border-border p-5"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <h4 className="font-semibold text-foreground">
                            {recommendation.title}
                          </h4>

                          <span
                            className={`shrink-0 rounded-lg border px-3 py-1 text-xs ${priorityClassName(
                              recommendation.priority
                            )}`}
                          >
                            {priorityLabel(recommendation.priority)}
                          </span>
                        </div>

                        <p className="leading-6 text-muted">
                          {recommendation.description}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
