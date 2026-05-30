import jwt from "jsonwebtoken";

type TokenPayload = {
  userId?: unknown;
  id?: unknown;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function createAuthToken(userId: number) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
}

export function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    const userId = decoded.userId ?? decoded.id;

    return typeof userId === "number" ? userId : null;
  } catch {
    return null;
  }
}
