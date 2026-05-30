import { calculateAnalytics, getUserSessions } from "@/app/lib/analytics";
import { getApiErrorMessage, getApiErrorStatus } from "@/app/lib/api-errors";
import { getUserIdFromRequest } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const [sessions, profile, recommendations] = await Promise.all([
      getUserSessions(userId),
      prisma.focusProfile.findUnique({
        where: { userId },
      }),
      prisma.recommendation.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const analytics = calculateAnalytics(sessions);

    return NextResponse.json({
      ...analytics,
      focusProfile: profile,
      recommendations,
    });
  } catch (error) {
    console.error("ANALYTICS_ERROR:", error);

    return NextResponse.json(
      { error: getApiErrorMessage(error, "Ошибка загрузки аналитики") },
      { status: getApiErrorStatus(error) }
    );
  }
}
