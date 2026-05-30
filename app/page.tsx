import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-4xl font-bold text-slate-950 sm:text-5xl">
              AI Productivity Tracker
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Управление задачами, запуск фокус-сессий, аналитика продуктивности
              и AI-рекомендации в одном рабочем пространстве.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg bg-slate-950 px-5 py-3 text-center font-medium text-white hover:bg-slate-800"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-medium text-slate-950 hover:bg-slate-100"
              >
                Зарегистрироваться
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4">
              {[
                ["Задачи", "Создание, редактирование, приоритет и статус"],
                ["Фокус-сессии", "25/5, 50/10 и пользовательский режим"],
                ["Аналитика", "Метрики, графики и фокус-профиль"],
                ["AI-модуль", "Рекомендации по кнопке после 3 завершённых сессий"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg bg-slate-50 p-4">
                  <h2 className="font-semibold text-slate-950">{title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
