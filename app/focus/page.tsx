"use client";

import { TopNav } from "@/app/components/TopNav";
import { getStorage, getStoredToken } from "@/app/lib/browser-storage";
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
type SignalTone = "SOFT" | "NORMAL" | "LOUD";

const modeLabels: Record<Mode, string> = {
  POMODORO_25_5: "25/5",
  DEEP_WORK_50_10: "50/10",
  CUSTOM: "Пользовательский",
};

const signalToneLabels: Record<SignalTone, string> = {
  SOFT: "Мягкий",
  NORMAL: "Обычный",
  LOUD: "Громкий",
};

const signalToneGain: Record<SignalTone, number> = {
  SOFT: 0.32,
  NORMAL: 0.56,
  LOUD: 0.78,
};

const signalToneWave: Record<SignalTone, OscillatorType> = {
  SOFT: "sine",
  NORMAL: "triangle",
  LOUD: "square",
};

const signalSettingsStorageKey = "focusSignalSettings";

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

function getTimestamp() {
  return new Date().getTime();
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
  const [phaseNotice, setPhaseNotice] = useState("");
  const [signalTone, setSignalTone] = useState<SignalTone>("NORMAL");
  const [signalVolume, setSignalVolume] = useState(90);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalSettingsLoadedRef = useRef(false);
  const completedCyclesRef = useRef(0);
  const interruptionsRef = useRef(0);
  const phaseRef = useRef<Phase>("focus");
  const phaseEndsAtRef = useRef<number | null>(null);
  const focusPhaseStartedAtRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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

  function showPhaseNotice(text: string) {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }

    setPhaseNotice(text);

    noticeTimeoutRef.current = setTimeout(() => {
      setPhaseNotice("");
    }, 3500);
  }

  function vibrateSignal(kind: "start" | "transition" | "finish") {
    if (!navigator.vibrate) return;

    const pattern =
      kind === "finish"
        ? [180, 90, 180, 90, 240]
        : kind === "transition"
          ? [160, 80, 160]
          : [140];

    navigator.vibrate(pattern);
  }

  function getAudioContext() {
    const AudioContextConstructor =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextConstructor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    return audioContextRef.current;
  }

  function playSignal(kind: "start" | "transition" | "finish") {
    const audioContext = getAudioContext();

    vibrateSignal(kind);

    if (!audioContext) return;

    void audioContext.resume();

    const pattern =
      kind === "start"
        ? [660]
        : kind === "finish"
          ? [880, 660, 880]
          : [740, 520];

    pattern.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime + index * 0.24;
      const duration = 0.22;
      const safeVolume = Math.min(Math.max(signalVolume, 0), 100) / 100;
      const targetGain = signalToneGain[signalTone] * safeVolume;

      oscillator.type = signalToneWave[signalTone];
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(targetGain, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    });
  }

  function getCurrentFocusSeconds(now = getTimestamp()) {
    if (
      phaseRef.current !== "focus" ||
      focusPhaseStartedAtRef.current === null
    ) {
      return focusSecondsWorkedRef.current;
    }

    const currentSegmentSeconds = Math.max(
      0,
      Math.floor((now - focusPhaseStartedAtRef.current) / 1000)
    );

    return focusSecondsWorkedRef.current + currentSegmentSeconds;
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

    const tick = () => {
      const endsAt = phaseEndsAtRef.current;

      if (!endsAt) return;

      const now = getTimestamp();
      const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));

      setTimeLeft(remainingSeconds);

      if (now < endsAt) return;

      const cycles = Number(plannedCycles);
      const focusSeconds = Number(focusDuration) * 60;
      const breakSeconds = Number(breakDuration) * 60;

      if (phaseRef.current === "focus") {
        const nextCompleted = Math.min(completedCyclesRef.current + 1, cycles);

        focusSecondsWorkedRef.current += focusSeconds;
        focusPhaseStartedAtRef.current = null;
        completedCyclesRef.current = nextCompleted;
        setCompletedCycles(nextCompleted);

        if (nextCompleted >= cycles) {
          phaseEndsAtRef.current = null;
          stopTimer();
          setIsStarted(false);
          setPhase("focus");
          phaseRef.current = "focus";
          showPhaseNotice("Сессия завершена");
          playSignal("finish");
          void saveSession(nextCompleted);
          return;
        }

        phaseRef.current = "break";
        phaseEndsAtRef.current = now + breakSeconds * 1000;
        setPhase("break");
        setTimeLeft(breakSeconds);
        showPhaseNotice("Перерыв начался");
        playSignal("transition");
        return;
      }

      phaseRef.current = "focus";
      focusPhaseStartedAtRef.current = now;
      phaseEndsAtRef.current = now + focusSeconds * 1000;
      setPhase("focus");
      setTimeLeft(focusSeconds);
      showPhaseNotice("Фокус начался");
      playSignal("transition");
    };

    tick();
    intervalRef.current = setInterval(tick, 250);
  }

  async function startSession() {
    if (!validateSettings()) return;

    await markTaskInProgress();

    stopTimer();

    const now = getTimestamp();
    const focusSeconds = Number(focusDuration) * 60;

    completedCyclesRef.current = 0;
    interruptionsRef.current = 0;
    phaseRef.current = "focus";
    phaseEndsAtRef.current = now + focusSeconds * 1000;
    focusPhaseStartedAtRef.current = now;
    savedRef.current = false;
    startTimeRef.current = new Date(now).toISOString();
    focusSecondsWorkedRef.current = 0;

    setCompletedCycles(0);
    setInterruptions(0);
    setPhase("focus");
    setIsStarted(true);
    setTimeLeft(focusSeconds);
    setMessage("Фокус-сессия запущена");

    showPhaseNotice("Фокус начался");
    playSignal("start");
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
    showPhaseNotice("Сессия завершена");
    playSignal("finish");

    focusSecondsWorkedRef.current = getCurrentFocusSeconds();
    focusPhaseStartedAtRef.current = null;
    phaseEndsAtRef.current = null;
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
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
      stopTimer();
      void audioContextRef.current?.close();
    };
  }, [loadInitialData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storage = getStorage();
      const storedSettings = storage?.getItem(signalSettingsStorageKey);

      if (!storedSettings) {
        signalSettingsLoadedRef.current = true;
        return;
      }

      try {
        const parsedSettings = JSON.parse(storedSettings) as {
          tone?: SignalTone;
          volume?: number;
        };

        if (
          parsedSettings.tone &&
          Object.keys(signalToneLabels).includes(parsedSettings.tone)
        ) {
          setSignalTone(parsedSettings.tone);
        }

        if (typeof parsedSettings.volume === "number") {
          setSignalVolume(Math.min(Math.max(parsedSettings.volume, 0), 100));
        }
      } catch {
        storage?.removeItem(signalSettingsStorageKey);
      }

      signalSettingsLoadedRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!signalSettingsLoadedRef.current) return;

    getStorage()?.setItem(
      signalSettingsStorageKey,
      JSON.stringify({
        tone: signalTone,
        volume: signalVolume,
      })
    );
  }, [signalTone, signalVolume]);

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
                  className="rounded-lg border border-border p-3 disabled:bg-background"
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
                  className="rounded-lg border border-border p-3 disabled:bg-background"
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
                    className="rounded-lg border border-border p-3 disabled:bg-background"
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
                    className="rounded-lg border border-border p-3 disabled:bg-background"
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
                    className="rounded-lg border border-border p-3 disabled:bg-background"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
                  <label className="grid gap-2 text-sm font-medium text-muted">
                    Тип сигнала
                    <select
                      value={signalTone}
                      onChange={(e) =>
                        setSignalTone(e.target.value as SignalTone)
                      }
                      className="rounded-lg border border-border bg-surface p-3"
                    >
                      {Object.entries(signalToneLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-muted">
                    <span className="flex items-center justify-between gap-3">
                      Громкость сигнала
                      <span className="font-semibold text-foreground">
                        {signalVolume}%
                      </span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={signalVolume}
                      onChange={(e) => setSignalVolume(Number(e.target.value))}
                      className="h-2 accent-foreground"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">
                  На телефоне сигнал может сопровождаться вибрацией, если браузер
                  и устройство её поддерживают.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
            <div className="inline-flex rounded-lg bg-background px-4 py-2 text-sm font-medium text-muted">
              {phase === "break" ? "Перерыв" : "Фокус"}
            </div>

            <div className="mt-5 text-6xl font-bold text-foreground sm:text-7xl">
              {formatTime(timeLeft)}
            </div>

            {phaseNotice && (
              <div
                aria-live="polite"
                className="mt-5 rounded-lg border border-foreground bg-foreground px-4 py-3 text-xl font-semibold text-background"
              >
                {phaseNotice}
              </div>
            )}

            <div className="mt-6 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-muted">Завершено циклов</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {safeCompletedCycles} / {cycles}
              </p>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-background">
                <div
                  className="h-3 rounded-full bg-accent"
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
                  className="rounded-lg bg-foreground p-3 font-medium text-background transition hover:bg-accent active:bg-accent"
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
                    className="rounded-lg bg-foreground p-3 font-medium text-background transition hover:bg-accent active:bg-accent"
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
