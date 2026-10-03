import { useSyncExternalStore } from "react";
import { SessionUser } from "./types";

const SESSION_KEY = "mobility_desk_user";
const SESSION_CHANGE_EVENT = "mobility_desk_session_change";

export function saveUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (
      parsed &&
      typeof parsed.name === "string" &&
      ["student", "employee", "rider"].includes(parsed.role)
    ) {
      return parsed as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function subscribeToSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedSnapshot: SessionUser | null = null;
let lastRawData: string | null = null;

function getSessionSnapshot(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw !== lastRawData) {
    lastRawData = raw;
    cachedSnapshot = getUser();
  }
  return cachedSnapshot;
}

export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null
  );
}
