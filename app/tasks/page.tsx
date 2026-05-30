"use client";

import { TopNav } from "@/app/components/TopNav";
import { getStoredToken } from "@/app/lib/browser-storage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
};

const statusLabels: Record<TaskStatus, string> = {
  TODO: "Запланирована",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершена",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};

function getToken() {
  return getStoredToken();
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [message, setMessage] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/tasks", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ошибка загрузки задач");
      return;
    }

    setTasks(data);
  }, [router]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        description,
        priority,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ошибка создания задачи");
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setMessage("Задача создана");

    await loadTasks();
  }

  async function updateTask(taskId: number, updates: Partial<Task>) {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return false;
    }

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ошибка обновления задачи");
      return false;
    }

    await loadTasks();
    return true;
  }

  async function saveEditedTask(e: React.FormEvent) {
    e.preventDefault();

    if (!editingTask) return;

    const isSaved = await updateTask(editingTask.id, editingTask);

    if (isSaved) {
      setEditingTask(null);
      setMessage("Задача обновлена");
    }
  }

  async function deleteTask(taskId: number) {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    await loadTasks();
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadTasks]);

  return (
    <main className="min-h-screen bg-background">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Задачи</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Создавайте задачи, задавайте приоритет и обновляйте статус перед
            запуском фокус-сессии.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            onSubmit={createTask}
            className="rounded-lg border border-border bg-surface p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Новая задача</h2>

            <div className="mt-5 grid gap-4">
              <input
                type="text"
                placeholder="Название задачи"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-border p-3"
              />

              <textarea
                placeholder="Описание"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 rounded-lg border border-border p-3"
              />

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-border p-3"
              >
                <option value="LOW">Низкий приоритет</option>
                <option value="MEDIUM">Средний приоритет</option>
                <option value="HIGH">Высокий приоритет</option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-foreground p-3 font-medium text-background hover:bg-muted"
              >
                Создать задачу
              </button>
            </div>

            {message && <p className="mt-4 text-sm text-muted">{message}</p>}
          </form>

          <section className="grid gap-4">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
                Пока нет задач. Создайте первую задачу для фокус-сессии.
              </div>
            ) : (
              tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-lg border border-border bg-cool p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        {task.title}
                      </h2>

                      {task.description && (
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingTask(task)}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-cool"
                    >
                      Редактировать
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-lg bg-cool px-3 py-1 text-muted">
                      {statusLabels[task.status]}
                    </span>
                    <span className="rounded-lg bg-cool px-3 py-1 text-muted">
                      {priorityLabels[task.priority]} приоритет
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {Object.keys(statusLabels).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          updateTask(task.id, { status: status as TaskStatus })
                        }
                        className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-cool"
                      >
                        {statusLabels[status as TaskStatus]}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="rounded-lg bg-accent-strong px-3 py-2 text-sm font-medium text-background hover:bg-muted"
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>

        {editingTask && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-foreground/50 px-4">
            <form
              onSubmit={saveEditedTask}
              className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold text-foreground">
                Редактирование задачи
              </h2>

              <div className="mt-5 grid gap-4">
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, title: e.target.value })
                  }
                  className="rounded-lg border border-border p-3"
                />

                <textarea
                  value={editingTask.description ?? ""}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      description: e.target.value,
                    })
                  }
                  className="min-h-28 rounded-lg border border-border p-3"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={editingTask.status}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="rounded-lg border border-border p-3"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editingTask.priority}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="rounded-lg border border-border p-3"
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-lg bg-foreground px-4 py-3 font-medium text-background"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-lg border border-border px-4 py-3 font-medium text-muted"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
