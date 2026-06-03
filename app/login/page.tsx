"use client";

import { saveSession } from "@/app/lib/browser-storage";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ошибка входа");
      setIsSubmitting(false);
      return;
    }

    if (!saveSession(data.token, data.user)) {
      setMessage("Браузер не позволяет сохранить сессию");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleLogin}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Вход</h1>
          <p className="mt-2 text-sm text-muted">
            Войдите, чтобы продолжить работу с задачами и аналитикой.
          </p>
        </div>

        <input
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border p-3"
        />

        <input
          type="password"
          aria-label="Пароль"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border p-3"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-foreground p-3 font-medium text-background transition hover:bg-accent active:bg-accent disabled:bg-border"
        >
          {isSubmitting ? "Вход..." : "Войти"}
        </button>

        {message && <p className="text-sm text-accent-strong">{message}</p>}

        <p className="text-sm text-muted">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-foreground">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </main>
  );
}
