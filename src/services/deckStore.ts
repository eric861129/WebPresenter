import { clearDeckRecords, getAllDeckRecords, getDeckRecord, saveDeckRecord } from "./database";
import type { DeckDocument, DeckRecordSummary } from "../types";

const ACTIVE_DECK_KEY = "webpresenter.activeDeckId";

export async function persistDeck(deck: DeckDocument, file: File | Blob) {
  await saveDeckRecord({
    deck,
    file,
  });
  localStorage.setItem(ACTIVE_DECK_KEY, deck.id);
}

export async function loadDeck(deckId: string) {
  return getDeckRecord(deckId);
}

export async function loadRecentDecks(): Promise<DeckRecordSummary[]> {
  const records = await getAllDeckRecords();
  return records
    .map((record) => ({
      id: record.deck.id,
      title: record.deck.title,
      sourceType: record.deck.sourceType,
      totalSlides: record.deck.totalSlides,
      warnings: record.deck.warnings,
      createdAt: record.deck.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function setActiveDeckId(deckId: string) {
  localStorage.setItem(ACTIVE_DECK_KEY, deckId);
}

export function getActiveDeckId() {
  return localStorage.getItem(ACTIVE_DECK_KEY);
}

export async function clearStoredDecks() {
  await clearDeckRecords();
  localStorage.removeItem(ACTIVE_DECK_KEY);
}
