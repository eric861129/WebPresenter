import { describe, expect, it } from "vitest";

import { createPresentationSession, validateSessionForDeck } from "../services/sessionState";
import type { DeckDocument, PresentationSession } from "../types";

function buildDeck(totalSlides: number): DeckDocument {
  return {
    id: "deck-1",
    sourceType: "pdf",
    title: "Deck",
    totalSlides,
    slides: Array.from({ length: totalSlides }, (_, index) => ({
      index,
      contentModel: {
        kind: "pdf" as const,
        width: 1280,
        height: 720,
        pageNumber: index + 1,
      },
    })),
    warnings: [],
    createdAt: Date.now(),
  };
}

describe("sessionState helpers", () => {
  it("creates a fresh presentation session", () => {
    expect(createPresentationSession("deck-1", "single")).toMatchObject({
      deckId: "deck-1",
      currentSlide: 0,
      blackout: false,
      mode: "single",
      connectedRemote: [],
    });
  });

  it("rejects a session from a different deck", () => {
    const session: PresentationSession = {
      sessionId: "session-1",
      deckId: "deck-2",
      currentSlide: 3,
      blackout: false,
      mode: "single",
      connectedRemote: [],
      startedAt: 1,
    };

    expect(validateSessionForDeck(session, buildDeck(5))).toBeNull();
  });

  it("clamps slide index to the loaded deck range", () => {
    const session: PresentationSession = {
      sessionId: "session-1",
      deckId: "deck-1",
      currentSlide: 99,
      blackout: false,
      mode: "dual",
      connectedRemote: [],
      startedAt: 1,
    };

    expect(validateSessionForDeck(session, buildDeck(4))).toMatchObject({
      currentSlide: 3,
    });
  });
});
