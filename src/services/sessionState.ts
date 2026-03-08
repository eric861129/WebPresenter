import type { PresentationSession } from "../types";

const ACTIVE_SESSION_KEY = "webpresenter.activeSession";

export function readSessionState() {
  const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PresentationSession;
  } catch {
    return null;
  }
}

export function writeSessionState(session: PresentationSession) {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export function clearSessionState() {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}
