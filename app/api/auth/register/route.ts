import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import {
  databaseUnavailableMessage,
  isDatabaseConnectionError,
} from "@/app/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || !email || !password) {
      return Response.json(
        { error: "Заполните все поля" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: "Пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (existingUser) {
      return Response.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    return Response.json({
      message: "Регистрация прошла успешно",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("REGISTER_ERROR", error);

    if (isDatabaseConnectionError(error)) {
      return Response.json(
        { error: databaseUnavailableMessage },
        { status: 503 }
      );
    }

    return Response.json(
      { error: "Ошибка регистрации" },
      { status: 500 }
    );
  }
}
