import { prisma } from "@/app/lib/prisma";
import { getUserIdFromRequest } from "@/app/lib/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/app/lib/api-errors";
import { calculateProductivityScore, createProductivityMetricSnapshot } from "@/app/lib/analytics";

const modes = ["POMODORO_25_5", "DEEP_WORK_50_10", "CUSTOM"] as const;

function isMode(value: unknown): value is (typeof modes)[number] {
  return modes.includes(value as (typeof modes)[number]);
}

function positiveInteger(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function GET(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return Response.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const sessions = await prisma.focusSession.findMany({
      where: { userId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
      take: 20,
    });

    return Response.json(sessions);
  } catch (error) {
    console.error("FOCUS_SESSIONS_GET_ERROR", error);

    return Response.json(
      { error: getApiErrorMessage(error, "Ошибка загрузки фокус-сессий") },
      { status: getApiErrorStatus(error) }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return Response.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const mode = isMode(body.mode) ? body.mode : null;
    const focusDuration = positiveInteger(body.focusDuration);
    const breakDuration = positiveInteger(body.breakDuration);
    const plannedCycles = positiveInteger(body.plannedCycles);
    const rawCompletedCycles = Number(body.completedCycles);
    const completedCycles =
      Number.isInteger(rawCompletedCycles) && rawCompletedCycles >= 0
        ? rawCompletedCycles
        : null;
    const interruptions = Math.max(0, Number(body.interruptions) || 0);
    const duration = Math.max(0, Number(body.duration) || 0);
    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const taskId = body.taskId ? Number(body.taskId) : null;

    if (!mode || !focusDuration || !breakDuration || !plannedCycles || completedCycles === null) {
      return Response.json(
        { error: "Некорректные данные фокус-сессии" },
        { status: 400 }
      );
    }

    if (Number.isNaN(startTime.getTime())) {
      return Response.json(
        { error: "Некорректное время начала сессии" },
        { status: 400 }
      );
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          userId,
        },
        select: { id: true },
      });

      if (!task) {
        return Response.json(
          { error: "Выбранная задача не найдена" },
          { status: 404 }
        );
      }
    }

    const safeCompletedCycles = Math.min(completedCycles, plannedCycles);
    const productivityScore = calculateProductivityScore(
      safeCompletedCycles,
      plannedCycles,
      interruptions
    );

    const session = await prisma.focusSession.create({
      data: {
        mode,
        focusDuration,
        breakDuration,
        plannedCycles,
        completedCycles: safeCompletedCycles,
        startTime,
        endTime: new Date(),
        duration,
        interruptions,
        productivityScore,
        taskId,
        userId,
      },
    });

    if (taskId && safeCompletedCycles > 0) {
      await prisma.task.updateMany({
        where: {
          id: taskId,
          userId,
        },
        data: {
          status: "IN_PROGRESS",
        },
      });
    }

    await createProductivityMetricSnapshot(userId);

    return Response.json(session);
  } catch (error) {
    console.error("FOCUS_SESSIONS_POST_ERROR", error);

    return Response.json(
      { error: getApiErrorMessage(error, "Ошибка сохранения фокус-сессии") },
      { status: getApiErrorStatus(error) }
    );
  }
}
