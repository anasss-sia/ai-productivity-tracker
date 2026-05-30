export function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function getStoredToken() {
  return getStorage()?.getItem("token") ?? null;
}

export function getStoredUser() {
  const user = getStorage()?.getItem("user");

  if (!user) return null;

  try {
    return JSON.parse(user) as {
      id: number;
      name: string;
      email: string;
    };
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: unknown) {
  const storage = getStorage();

  if (!storage) return false;

  storage.setItem("token", token);
  storage.setItem("user", JSON.stringify(user));

  return true;
}

export function clearSession() {
  const storage = getStorage();

  storage?.removeItem("token");
  storage?.removeItem("user");
}
