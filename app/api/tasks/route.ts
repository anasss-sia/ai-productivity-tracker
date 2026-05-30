import { prisma } from "@/app/lib/prisma";
import { getUserIdFromRequest } from "@/app/lib/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/app/lib/api-errors";
import { NextResponse } from "next/server";

const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
const statuses = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;

function isPriority(value: unknown): value is (typeof priorities)[number] {
  return priorities.includes(value as (typeof priorities)[number]);
}

function isStatus(value: unknown): value is (typeof statuses)[number] {
  return statuses.includes(value as (typeof statuses)[number]);
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const tasks = await prisma.task.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("TASKS_GET_ERROR", error);

    return NextResponse.json(
      { error: getApiErrorMessage(error, "Ошибка загрузки задач") },
      { status: getApiErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const priority = isPriority(body.priority) ? body.priority : "MEDIUM";
    const status = isStatus(body.status) ? body.status : "TODO";

    if (!title) {
      return NextResponse.json(
        { error: "Введите название задачи" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority,
        status,
        userId,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("TASKS_POST_ERROR", error);

    return NextResponse.json(
      { error: getApiErrorMessage(error, "Ошибка создания задачи") },
      { status: getApiErrorStatus(error) }
    );
  }
}
