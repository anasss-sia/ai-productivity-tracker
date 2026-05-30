"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    setMessage(data.message || data.error);
    setIsSubmitting(false);

    if (response.ok) {
      setTimeout(() => router.push("/login"), 700);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleRegister}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Регистрация</h1>
          <p className="mt-2 text-sm text-muted">
            Создайте учётную запись для сохранения задач и фокус-сессий.
          </p>
        </div>

        <input
          type="text"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border p-3"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border p-3"
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border p-3"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-foreground p-3 font-medium text-background disabled:bg-border"
        >
          {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        {message && (
          <p className="text-sm text-muted">
            {message}
          </p>
        )}

        <p className="text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-foreground">
            Войти
          </Link>
        </p>
      </form>
    </main>
  );
}
