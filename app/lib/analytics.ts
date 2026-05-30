import { prisma } from "@/app/lib/prisma";
import type { FocusSession, SessionMode } from "@prisma/client";

export type SessionForAnalytics = Pick<
  FocusSession,
  | "id"
  | "mode"
  | "focusDuration"
  | "breakDuration"
  | "plannedCycles"
  | "completedCycles"
  | "startTime"
  | "duration"
  | "interruptions"
  | "productivityScore"
>;

type ModeCount = {
  mode: SessionMode;
  count: number;
};

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateCompletionRate(completedCycles: number, plannedCycles: number) {
  if (plannedCycles <= 0) return 0;

  return Number(((completedCycles / plannedCycles) * 100).toFixed(2));
}

export function calculateProductivityScore(
  completedCycles: number,
  plannedCycles: number,
  interruptions: number
) {
  return clampScore(calculateCompletionRate(completedCycles, plannedCycles) - interruptions * 5);
}

function average(numbers: number[], digits = 0) {
  if (numbers.length === 0) return 0;

  const value = numbers.reduce((sum, item) => sum + item, 0) / numbers.length;

  return Number(value.toFixed(digits));
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatHourRange(hour: number | null) {
  if (hour === null) return null;

  const nextHour = (hour + 1) % 24;

  return `${String(hour).padStart(2, "0")}:00-${String(nextHour).padStart(2, "0")}:00`;
}

export function getModeCounts(sessions: SessionForAnalytics[]): ModeCount[] {
  const counts = new Map<SessionMode, number>();

  sessions.forEach((session) => {
    counts.set(session.mode, (counts.get(session.mode) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);
}

export function calculateAnalytics(sessions: SessionForAnalytics[]) {
  const totalSessions = sessions.length;
  const completedSessionsList = sessions.filter(
    (session) => session.completedCycles >= session.plannedCycles
  );
  const completedSessions = completedSessionsList.length;
  const totalFocusMinutes = sessions.reduce((sum, session) => sum + (session.duration ?? 0), 0);
  const totalInterruptions = sessions.reduce((sum, session) => sum + session.interruptions, 0);
  const totalPlannedCycles = sessions.reduce((sum, session) => sum + session.plannedCycles, 0);
  const totalCompletedCycles = sessions.reduce(
    (sum, session) => sum + Math.min(session.completedCycles, session.plannedCycles),
    0
  );
  const completionRate = calculateCompletionRate(totalCompletedCycles, totalPlannedCycles);
  const averageFocusDuration = average(
    sessions.map((session) => session.duration ?? 0).filter((duration) => duration > 0)
  );
  const averageInterruptions = average(
    sessions.map((session) => session.interruptions),
    1
  );
  const averageProductivityScore = average(
    sessions.map((session) => session.productivityScore ?? 0)
  );

  const hourly = new Map<
    number,
    { sessions: number; minutes: number; score: number; interruptions: number }
  >();

  completedSessionsList.forEach((session) => {
    const hour = session.startTime.getHours();
    const current = hourly.get(hour) ?? {
      sessions: 0,
      minutes: 0,
      score: 0,
      interruptions: 0,
    };

    current.sessions += 1;
    current.minutes += session.duration ?? 0;
    current.score += session.productivityScore ?? 0;
    current.interruptions += session.interruptions;

    hourly.set(hour, current);
  });

  let bestFocusHour: number | null = null;
  let bestHourScore = Number.NEGATIVE_INFINITY;

  hourly.forEach((value, hour) => {
    const weightedScore =
      value.score / value.sessions - (value.interruptions / value.sessions) * 5 + value.minutes / 60;

    if (weightedScore > bestHourScore) {
      bestHourScore = weightedScore;
      bestFocusHour = hour;
    }
  });

  const dailyFocusMap = new Map<string, number>();
  sessions.forEach((session) => {
    const key = formatDateKey(session.startTime);
    dailyFocusMap.set(key, (dailyFocusMap.get(key) ?? 0) + (session.duration ?? 0));
  });

  const dailyFocus = Array.from(dailyFocusMap.entries())
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  const cycleCompletion = sessions
    .slice()
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(-8)
    .map((session) => ({
      id: session.id,
      date: formatDateKey(session.startTime),
      plannedCycles: session.plannedCycles,
      completedCycles: Math.min(session.completedCycles, session.plannedCycles),
      completionRate: calculateCompletionRate(
        Math.min(session.completedCycles, session.plannedCycles),
        session.plannedCycles
      ),
    }));

  const hourlyProductivity = Array.from({ length: 24 }, (_, hour) => {
    const value = hourly.get(hour);

    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      sessions: value?.sessions ?? 0,
      minutes: value?.minutes ?? 0,
      score: value ? Math.round(value.score / value.sessions) : 0,
    };
  });

  const focusStability = clampScore(completionRate - averageInterruptions * 10);

  return {
    totalSessions,
    completedSessions,
    totalFocusMinutes,
    averageFocusDuration,
    averageFocusTime: averageFocusDuration,
    totalInterruptions,
    averageInterruptions,
    totalPlannedCycles,
    totalCompletedCycles,
    completionRate,
    averageProductivityScore,
    productivityScore: averageProductivityScore,
    focusStability,
    bestFocusHour,
    bestFocusTimeRange: formatHourRange(bestFocusHour),
    modeCounts: getModeCounts(sessions),
    charts: {
      dailyFocus,
      cycleCompletion,
      hourlyProductivity,
    },
  };
}

export async function getUserSessions(userId: number) {
  return prisma.focusSession.findMany({
    where: { userId },
    orderBy: { startTime: "desc" },
  });
}

export async function createProductivityMetricSnapshot(userId: number) {
  const sessions = await getUserSessions(userId);
  const analytics = calculateAnalytics(sessions);
  const sortedSessions = sessions.slice().sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const periodStart = sortedSessions[0]?.startTime ?? new Date();
  const periodEnd = new Date();

  const metric = await prisma.productivityMetric.create({
    data: {
      userId,
      periodType: "MONTH",
      periodStart,
      periodEnd,
      totalFocusMinutes: analytics.totalFocusMinutes,
      completedSessions: analytics.completedSessions,
      averageFocusDuration: analytics.averageFocusDuration,
      averageInterruptions: analytics.averageInterruptions,
      completionRate: analytics.completionRate,
      consistencyScore: analytics.focusStability,
      productivityScore: analytics.averageProductivityScore,
      bestFocusHour: analytics.bestFocusHour,
    },
  });

  return { metric, analytics, sessions };
}
