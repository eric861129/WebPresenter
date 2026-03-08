import { openDB } from "idb";
import type { DBSchema } from "idb";

import type { DeckDocument } from "../types";

type DeckStoredRecord = {
  deck: DeckDocument;
  file: Blob;
};

interface WebPresenterDb extends DBSchema {
  decks: {
    key: string;
    value: DeckStoredRecord;
  };
  prefs: {
    key: string;
    value: unknown;
  };
}

export const dbPromise = openDB<WebPresenterDb>("webpresenter", 1, {
  upgrade(db) {
    db.createObjectStore("decks");
    db.createObjectStore("prefs");
  },
});

export async function saveDeckRecord(record: DeckStoredRecord) {
  const db = await dbPromise;
  await db.put("decks", record, record.deck.id);
}

export async function getDeckRecord(deckId: string) {
  const db = await dbPromise;
  return db.get("decks", deckId);
}

export async function getAllDeckRecords() {
  const db = await dbPromise;
  return db.getAll("decks");
}

export async function clearDeckRecords() {
  const db = await dbPromise;
  await db.clear("decks");
}

export async function setPreference<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put("prefs", value, key);
}

export async function getPreference<T>(key: string) {
  const db = await dbPromise;
  return (await db.get("prefs", key)) as T | undefined;
}
