import type { DeckDocument, PresentationMode, PresentationSession } from "../types";

const ACTIVE_SESSION_KEY = "webpresenter.activeSession";

export function createPresentationSession(deckId: string, mode: PresentationMode): PresentationSession {
  return {
    sessionId: crypto.randomUUID(),
    deckId,
    currentSlide: 0,
    blackout: false,
    mode,
    connectedRemote: [],
    startedAt: Date.now(),
  };
}

export function validateSessionForDeck(session: PresentationSession | null, deck: DeckDocument) {
  if (!session || session.deckId !== deck.id) {
    return null;
  }

  const maxSlideIndex = Math.max(deck.totalSlides - 1, 0);
  const currentSlide = Math.min(maxSlideIndex, Math.max(0, session.currentSlide));

  if (currentSlide === session.currentSlide) {
    return session;
  }

  return {
    ...session,
    currentSlide,
  };
}

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
