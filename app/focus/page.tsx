"use client";

import { TopNav } from "@/app/components/TopNav";
import { getStoredToken } from "@/app/lib/browser-storage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Task = {
  id: number;
  title: string;
};

type FocusHistoryItem = {
  id: number;
  mode: string;
  focusDuration: number;
  breakDuration: number;
  plannedCycles: number;
  completedCycles: number;
  startTime: string;
  duration: number | null;
  interruptions: number;
  productivityScore: number | null;
  task: Task | null;
};

type Phase = "focus" | "break";
type Mode = "POMODORO_25_5" | "DEEP_WORK_50_10" | "CUSTOM";

const modeLabels: Record<Mode, string> = {
  POMODORO_25_5: "25/5",
  DEEP_WORK_50_10: "50/10",
  CUSTOM: "Пользовательский",
};

function getToken() {
  return getStoredToken();
}

function cleanPositiveNumber(value: string) {
  const onlyDigits = value.replace(/\D/g, "");
  return onlyDigits.replace(/^0+/, "");
}

function getValidNumber(value: string, fallback: number) {
  const number = Number(value);
  return number > 0 ? number : fallback;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

export default function FocusPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<FocusHistoryItem[]>([]);
  const [taskId, setTaskId] = useState("");
  const [mode, setMode] = useState<Mode>("POMODORO_25_5");
  const [focusDuration, setFocusDuration] = useState("25");
  const [breakDuration, setBreakDuration] = useState("5");
  const [plannedCycles, setPlannedCycles] = useState("1");
  const [completedCycles, setCompletedCycles] = useState(0);
  const [interruptions, setInterruptions] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [message, setMessage] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedCyclesRef = useRef(0);
  const interruptionsRef = useRef(0);
  const phaseRef = useRef<Phase>("focus");
  const savedRef = useRef(false);
  const startTimeRef = useRef<string | null>(null);
  const focusSecondsWorkedRef = useRef(0);

  const loadInitialData = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const [tasksResponse, historyResponse] = await Promise.all([
      fetch("/api/tasks", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      fetch("/api/focus-sessions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ]);

    if (tasksResponse.ok) {
      setTasks(await tasksResponse.json());
    }

    if (historyResponse.ok) {
      setHistory(await historyResponse.json());
    }
  }, [router]);

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function validateSettings() {
    if (!focusDuration || Number(focusDuration) <= 0) {
      setMessage("Введите длительность работы больше 0");
      return false;
    }

    if (!breakDuration || Number(breakDuration) <= 0) {
      setMessage("Введите длительность перерыва больше 0");
      return false;
    }

    if (!plannedCycles || Number(plannedCycles) <= 0) {
      setMessage("Введите количество циклов больше 0");
      return false;
    }

    return true;
  }

  function changeMode(value: Mode) {
    if (isStarted) return;

    setMode(value);

    if (value === "POMODORO_25_5") {
      setFocusDuration("25");
      setBreakDuration("5");
      setTimeLeft(25 * 60);
    }

    if (value === "DEEP_WORK_50_10") {
      setFocusDuration("50");
      setBreakDuration("10");
      setTimeLeft(50 * 60);
    }

    if (value === "CUSTOM") {
      setTimeLeft(getValidNumber(focusDuration, 1) * 60);
    }
  }

  async function markTaskInProgress() {
    if (!taskId) return;

    const token = getToken();

    if (!token) return;

    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "IN_PROGRESS",
      }),
    });
  }

  function runTimer() {
    stopTimer();

    intervalRef.current = setInterval(() => {
      setTimeLeft((currentTime) => {
        if (phaseRef.current === "focus") {
          focusSecondsWorkedRef.current += 1;
        }

        if (currentTime > 1) {
          return currentTime - 1;
        }

        const cycles = Number(plannedCycles);
        const focusSeconds = Number(focusDuration) * 60;
        const breakSeconds = Number(breakDuration) * 60;

        if (phaseRef.current === "focus") {
          const nextCompleted = Math.min(completedCyclesRef.current + 1, cycles);

          completedCyclesRef.current = nextCompleted;
          setCompletedCycles(nextCompleted);

          if (nextCompleted >= cycles) {
            stopTimer();
            setIsStarted(false);
            setPhase("focus");
            phaseRef.current = "focus";
            void saveSession(nextCompleted);
            return 0;
          }

          phaseRef.current = "break";
          setPhase("break");
          return breakSeconds;
        }

        phaseRef.current = "focus";
        setPhase("focus");
        return focusSeconds;
      });
    }, 1000);
  }

  async function startSession() {
    if (!validateSettings()) return;

    await markTaskInProgress();

    stopTimer();

    const now = new Date().toISOString();

    completedCyclesRef.current = 0;
    interruptionsRef.current = 0;
    phaseRef.current = "focus";
    savedRef.current = false;
    startTimeRef.current = now;
    focusSecondsWorkedRef.current = 0;

    setCompletedCycles(0);
    setInterruptions(0);
    setPhase("focus");
    setIsStarted(true);
    setTimeLeft(Number(focusDuration) * 60);
    setMessage("Фокус-сессия запущена");

    runTimer();
  }

  function addInterruption() {
    if (!isStarted) {
      setMessage("Сначала запусти сессию");
      return;
    }

    const nextInterruptions = interruptionsRef.current + 1;

    interruptionsRef.current = nextInterruptions;
    setInterruptions(nextInterruptions);
  }

  async function finishEarly() {
    if (!isStarted) {
      setMessage("Сначала запусти сессию");
      return;
    }

    stopTimer();

    setIsStarted(false);
    setPhase("focus");
    phaseRef.current = "focus";

    await saveSession(completedCyclesRef.current);
  }

  async function saveSession(finalCompletedCycles: number) {
    if (savedRef.current) return;

    savedRef.current = true;

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const focusMinutes = Number(focusDuration);
    const breakMinutes = Number(breakDuration);
    const cycles = Number(plannedCycles);
    const safeCompletedCycles = Math.min(finalCompletedCycles, cycles);
    const duration = Math.ceil(focusSecondsWorkedRef.current / 60);

    const response = await fetch("/api/focus-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mode,
        focusDuration: focusMinutes,
        breakDuration: breakMinutes,
        plannedCycles: cycles,
        completedCycles: safeCompletedCycles,
        startTime: startTimeRef.current || new Date().toISOString(),
        duration,
        interruptions: interruptionsRef.current,
        taskId: taskId || null,
      }),
    });

    if (!response.ok) {
      savedRef.current = false;
      setMessage("Ошибка сохранения сессии");
      return;
    }

    setTimeLeft(Number(focusDuration) * 60);
    setCompletedCycles(safeCompletedCycles);
    setMessage(
      safeCompletedCycles >= cycles
        ? "Все циклы завершены. Фокус-сессия сохранена"
        : "Фокус-сессия завершена досрочно и сохранена"
    );

    await loadInitialData();
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      stopTimer();
    };
  }, [loadInitialData]);

  const cycles = getValidNumber(plannedCycles, 1);
  const safeCompletedCycles = Math.min(completedCycles, cycles);
  const progress = Math.min((safeCompletedCycles / cycles) * 100, 100);

  return (
    <main className="min-h-screen bg-background">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Фокус-сессия</h1>
          <p className="mt-2 max-w-3xl text-muted">
            Выберите режим, укажите количество циклов, фиксируйте прерывания и
            сохраняйте результат для аналитики.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">Настройки</h2>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-muted">
                Задача
                <select
                  value={taskId}
                  disabled={isStarted}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="rounded-lg border border-border p-3 disabled:bg-cool"
                >
                  <option value="">Без задачи</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-muted">
                Режим работы
                <select
                  value={mode}
                  disabled={isStarted}
                  onChange={(e) => changeMode(e.target.value as Mode)}
                  className="rounded-lg border border-border p-3 disabled:bg-cool"
                >
                  <option value="POMODORO_25_5">25/5</option>
                  <option value="DEEP_WORK_50_10">50/10</option>
                  <option value="CUSTOM">Пользовательский режим</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid min-w-0 gap-2 text-sm font-medium text-muted">
                  Работа, мин
                  <input
                    type="text"
                    inputMode="numeric"
                    value={focusDuration}
                    disabled={mode !== "CUSTOM" || isStarted}
                    onChange={(e) => {
                      const value = cleanPositiveNumber(e.target.value);
                      setFocusDuration(value);
                      setTimeLeft(getValidNumber(value, 1) * 60);
                    }}
                    className="rounded-lg border border-border p-3 disabled:bg-cool"
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-sm font-medium text-muted">
                  Перерыв, мин
                  <input
                    type="text"
                    inputMode="numeric"
                    value={breakDuration}
                    disabled={mode !== "CUSTOM" || isStarted}
                    onChange={(e) =>
                      setBreakDuration(cleanPositiveNumber(e.target.value))
                    }
                    className="rounded-lg border border-border p-3 disabled:bg-cool"
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-sm font-medium text-muted">
                  Циклы
                  <input
                    type="text"
                    inputMode="numeric"
                    value={plannedCycles}
                    disabled={isStarted}
                    onChange={(e) =>
                      setPlannedCycles(cleanPositiveNumber(e.target.value))
                    }
                    className="rounded-lg border border-border p-3 disabled:bg-cool"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-cool p-6 text-center shadow-sm">
            <div className="inline-flex rounded-lg bg-surface px-4 py-2 text-sm font-medium text-muted">
              {phase === "break" ? "Перерыв" : "Фокус"}
            </div>

            <div className="mt-5 text-6xl font-bold text-foreground sm:text-7xl">
              {formatTime(timeLeft)}
            </div>

            <div className="mt-6 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-muted">Завершено циклов</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {safeCompletedCycles} / {cycles}
              </p>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-background">
                <div
                  className="h-3 rounded-full bg-accent-strong"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-4 text-sm text-muted">
                Прерывания: {interruptions}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {!isStarted ? (
                <button
                  type="button"
                  onClick={startSession}
                  className="rounded-lg bg-foreground p-3 font-medium text-background hover:bg-muted"
                >
                  Запустить сессию
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={addInterruption}
                    className="rounded-lg border border-border bg-surface p-3 font-medium text-muted hover:bg-background"
                  >
                    Отметить прерывание
                  </button>

                  <button
                    type="button"
                    onClick={finishEarly}
                    className="rounded-lg bg-accent-strong p-3 font-medium text-background hover:bg-muted"
                  >
                    Завершить сессию
                  </button>
                </>
              )}
            </div>

            {message && <p className="mt-4 text-sm text-muted">{message}</p>}
          </section>
        </div>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-foreground">История сессий</h2>

          <div className="mt-4 grid gap-3">
            {history.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-muted">
                Сохранённых фокус-сессий пока нет.
              </div>
            ) : (
              history.map((session) => (
                <article
                  key={session.id}
                  className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {session.task?.title ?? "Без задачи"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {new Date(session.startTime).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    Режим: {modeLabels[session.mode as Mode] ?? session.mode}
                  </p>
                  <p className="text-sm text-muted">
                    Циклы: {session.completedCycles}/{session.plannedCycles}
                  </p>
                  <p className="text-sm text-muted">
                    Фокус: {session.duration ?? 0} мин, прерывания:{" "}
                    {session.interruptions}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
