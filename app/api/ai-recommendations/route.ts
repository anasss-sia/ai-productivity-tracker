import {
  createProductivityMetricSnapshot,
  getUserSessions,
} from "@/app/lib/analytics";
import { getApiErrorMessage, getApiErrorStatus } from "@/app/lib/api-errors";
import { getUserIdFromRequest } from "@/app/lib/auth";
import {
  generateAiProfile,
  getConfiguredLlmModelName,
  getLlmProvider,
} from "@/app/lib/openai";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

function normalizeRecommendationCount<T>(items: T[]) {
  return items.length >= 4 ? items.slice(0, 5) : items;
}

function getAiErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Ошибка генерации AI-рекомендаций";
  }

  if (error.message === "EXTERNAL_LLM_API_KEY is not configured") {
    return "AI-модуль не настроен: добавьте EXTERNAL_LLM_API_KEY или выберите LLM_PROVIDER=ollama";
  }

  if (error.message === "LLM_PROVIDER is disabled") {
    return "AI-модуль временно отключён в публичной версии. Основные функции приложения работают, а генерация рекомендаций доступна при подключении LLM-провайдера";
  }

  if (error.message === "LLM_PROVIDER is unsupported") {
    return "AI-модуль настроен неверно: LLM_PROVIDER должен быть ollama, external или disabled";
  }

  if (
    error.message.includes("exceeded your current quota") ||
    error.message.includes("billing details") ||
    error.message.includes("insufficient_quota")
  ) {
    return "AI-модуль не смог сформировать рекомендации: у OpenAI API закончилась квота или не настроена оплата в аккаунте";
  }

  if (
    error.message.includes("fetch failed") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("Ollama")
  ) {
    return "AI-модуль не смог подключиться к Ollama: откройте приложение Ollama, скачайте модель и проверьте адрес OLLAMA_BASE_URL";
  }

  return `Ошибка AI-модуля: ${error.message}`;
}

export async function POST(request: Request) {
  let aiRequestId: number | null = null;

  try {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const existingSessions = await getUserSessions(userId);
    const completedSessions = existingSessions.filter(
      (session) => session.completedCycles >= session.plannedCycles
    );

    if (completedSessions.length < 3) {
      return NextResponse.json(
        {
          error:
            "Для генерации фокус-профиля нужно минимум 3 завершённые фокус-сессии",
          completedSessions: completedSessions.length,
          requiredSessions: 3,
        },
        { status: 400 }
      );
    }

    const { metric, analytics, sessions } = await createProductivityMetricSnapshot(userId);
    const promptPreviewContext = {
      analytics,
      sessions: sessions.slice(0, 20),
    };

    const pendingRequest = await prisma.aIRequest.create({
      data: {
        userId,
        metricsId: metric.id,
        requestStatus: "PENDING",
        modelName: `${getLlmProvider()}:${getConfiguredLlmModelName()}`,
        inputContextJson: JSON.stringify(promptPreviewContext),
      },
    });

    aiRequestId = pendingRequest.id;

    const ai = await generateAiProfile({
      analytics,
      sessions,
    });

    const profile = await prisma.focusProfile.upsert({
      where: {
        userId,
      },
      update: {
        bestFocusDuration: ai.result.profile.bestFocusDuration,
        optimalBreakDuration: ai.result.profile.optimalBreakDuration,
        peakHours: ai.result.profile.peakHours,
        focusStability: ai.result.profile.focusStability,
        summary: ai.result.profile.summary,
        profileVersion: {
          increment: 1,
        },
        basedOnMetricsId: metric.id,
      },
      create: {
        userId,
        bestFocusDuration: ai.result.profile.bestFocusDuration,
        optimalBreakDuration: ai.result.profile.optimalBreakDuration,
        peakHours: ai.result.profile.peakHours,
        focusStability: ai.result.profile.focusStability,
        summary: ai.result.profile.summary,
        profileVersion: 1,
        basedOnMetricsId: metric.id,
      },
    });

    await prisma.aIRequest.update({
      where: {
        id: aiRequestId,
      },
      data: {
        focusProfileId: profile.id,
        modelName: ai.model,
        promptSnapshot: ai.promptSnapshot,
        requestStatus: "SUCCESS",
      },
    });

    await prisma.recommendation.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const recommendationData = normalizeRecommendationCount(ai.result.recommendations).map(
      (recommendation) => ({
        userId,
        aiRequestId,
        title: recommendation.title,
        description: recommendation.description,
        type: recommendation.type,
        priority: recommendation.priority,
      })
    );

    await prisma.recommendation.createMany({
      data: recommendationData,
    });

    const recommendations = await prisma.recommendation.findMany({
      where: {
        userId,
        aiRequestId,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      message: "AI-рекомендации успешно сгенерированы",
      profile,
      metric,
      aiRequestId,
      recommendations,
    });
  } catch (error) {
    console.error("AI_RECOMMENDATIONS_ERROR:", error);

    if (aiRequestId) {
      try {
        await prisma.aIRequest.update({
          where: {
            id: aiRequestId,
          },
          data: {
            requestStatus: "FAILED",
          },
        });
      } catch (updateError) {
        console.error("AI_REQUEST_FAILED_STATUS_ERROR:", updateError);
      }
    }

    return NextResponse.json(
      {
        error: getApiErrorMessage(error, getAiErrorMessage(error)),
      },
      { status: getApiErrorStatus(error) }
    );
  }
}
