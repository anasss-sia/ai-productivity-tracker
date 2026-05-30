"use client";

import { TopNav } from "@/app/components/TopNav";
import { getStoredToken, getStoredUser } from "@/app/lib/browser-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
};

type AnalyticsSummary = {
  totalSessions: number;
  completedSessions: number;
  totalFocusMinutes: number;
  averageProductivityScore: number;
  bestFocusTimeRange: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const token = getStoredToken();
      const savedUser = getStoredUser();

      if (!token || !savedUser) {
        router.push("/login");
        return;
      }

      setUser(savedUser);

      void fetch("/api/analytics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) {
            setSummary(data);
          }
        });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <main className="min-h-screen bg-background">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Добро пожаловать, {user?.name ?? "пользователь"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Создавайте задачи, запускайте фокус-сессии и отслеживайте, какие
            условия помогают работать продуктивнее.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Минут фокуса", summary?.totalFocusMinutes ?? 0],
            ["Всего сессий", summary?.totalSessions ?? 0],
            ["Завершено сессий", summary?.completedSessions ?? 0],
            ["Продуктивность", summary?.averageProductivityScore ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Задачи",
              description: "Создать задачу, обновить статус и приоритет.",
              href: "/tasks",
              action: "Открыть задачи",
            },
            {
              title: "Фокус-сессия",
              description: "Запустить 25/5, 50/10 или пользовательский режим.",
              href: "/focus",
              action: "Запустить таймер",
            },
            {
              title: "Аналитика",
              description:
                summary?.bestFocusTimeRange
                  ? `Лучшее время: ${summary.bestFocusTimeRange}.`
                  : "Посмотреть метрики, графики и AI-профиль.",
              href: "/analytics",
              action: "Смотреть аналитику",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-border bg-cool p-6 shadow-sm transition hover:border-border hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted">
                {item.description}
              </p>
              <span className="mt-5 inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
                {item.action}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
