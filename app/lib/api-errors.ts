export function isDatabaseConnectionError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack ?? ""}`
      : String(error);

  return (
    /ECONNREFUSED|P1001/i.test(code) ||
    /ECONNREFUSED|Can't reach database|connect ECONNREFUSED|P1001/i.test(
      message
    )
  );
}

export const databaseUnavailableMessage =
  "База данных недоступна. Запустите PostgreSQL и повторите действие.";

export function getApiErrorMessage(error: unknown, fallback: string) {
  return isDatabaseConnectionError(error) ? databaseUnavailableMessage : fallback;
}

export function getApiErrorStatus(error: unknown) {
  return isDatabaseConnectionError(error) ? 503 : 500;
}
