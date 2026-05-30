import { prisma } from "@/app/lib/prisma";
import { getUserIdFromRequest } from "@/app/lib/auth";
import { getApiErrorMessage, getApiErrorStatus } from "@/app/lib/api-errors";

const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
const statuses = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;

function isPriority(value: unknown): value is (typeof priorities)[number] {
  return priorities.includes(value as (typeof priorities)[number]);
}

function isStatus(value: unknown): value is (typeof statuses)[number] {
  return statuses.includes(value as (typeof statuses)[number]);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return Response.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const data: {
      title?: string;
      description?: string | null;
      status?: (typeof statuses)[number];
      priority?: (typeof priorities)[number];
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();

      if (!title) {
        return Response.json(
          { error: "Введите название задачи" },
          { status: 400 }
        );
      }

      data.title = title;
    }

    if (body.description !== undefined) {
      const description = String(body.description).trim();
      data.description = description || null;
    }

    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return Response.json(
          { error: "Некорректный статус задачи" },
          { status: 400 }
        );
      }

      data.status = body.status;
    }

    if (body.priority !== undefined) {
      if (!isPriority(body.priority)) {
        return Response.json(
          { error: "Некорректный приоритет задачи" },
          { status: 400 }
        );
      }

      data.priority = body.priority;
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: "Нет данных для обновления" },
        { status: 400 }
      );
    }

    const task = await prisma.task.updateMany({
      where: {
        id: Number(id),
        userId,
      },
      data,
    });

    return Response.json(task);
  } catch (error) {
    console.error("TASK_PATCH_ERROR", error);

    return Response.json(
      { error: getApiErrorMessage(error, "Ошибка обновления задачи") },
      { status: getApiErrorStatus(error) }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return Response.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const { id } = await params;

    await prisma.task.deleteMany({
      where: {
        id: Number(id),
        userId,
      },
    });

    return Response.json({
      message: "Задача удалена",
    });
  } catch (error) {
    console.error("TASK_DELETE_ERROR", error);

    return Response.json(
      { error: getApiErrorMessage(error, "Ошибка удаления задачи") },
      { status: getApiErrorStatus(error) }
    );
  }
}
