import { prisma } from "@/app/lib/prisma";
import { createAuthToken } from "@/app/lib/auth";
import {
  databaseUnavailableMessage,
  isDatabaseConnectionError,
} from "@/app/lib/api-errors";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email || !body.password) {
      return Response.json(
        { error: "Введите email и пароль" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (!user) {
      return Response.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const isPasswordCorrect = await bcrypt.compare(
      body.password,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      return Response.json(
        { error: "Неверный пароль" },
        { status: 401 }
      );
    }

    const token = createAuthToken(user.id);

    return Response.json({
      message: "Вход выполнен успешно",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("LOGIN_ERROR", error);

    if (isDatabaseConnectionError(error)) {
      return Response.json(
        { error: databaseUnavailableMessage },
        { status: 503 }
      );
    }

    return Response.json(
      { error: "Ошибка входа" },
      { status: 500 }
    );
  }
}
