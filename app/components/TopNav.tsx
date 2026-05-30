"use client";

import { clearSession } from "@/app/lib/browser-storage";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Главная" },
  { href: "/tasks", label: "Мои задачи" },
  { href: "/focus", label: "Фокус-сессия" },
  { href: "/analytics", label: "Аналитика и профиль" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="border-b border-border bg-surface/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/dashboard" className="text-lg font-bold text-foreground">
          AI Productivity Tracker
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-6">
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-background hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="w-fit rounded-lg bg-accent-strong px-3 py-2 text-sm font-medium text-background transition hover:bg-foreground"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
