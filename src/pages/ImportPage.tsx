import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { importDeckFromFile } from "../services/deckImport";
import { loadRecentDecks, persistDeck, setActiveDeckId } from "../services/deckStore";
import type { DeckRecordSummary } from "../types";

export function ImportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDecks, setRecentDecks] = useState<DeckRecordSummary[]>([]);

  useEffect(() => {
    loadRecentDecks().then(setRecentDecks);
  }, []);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const deck = await importDeckFromFile(file);
      await persistDeck(deck, file);
      const updatedDecks = await loadRecentDecks();
      setRecentDecks(updatedDecks);
      startTransition(() => navigate("/present"));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="import-grid">
      <article className="panel hero-panel">
        <p className="eyebrow">GitHub Pages Ready</p>
        <h2>Import PDF or PPTX and switch into presentation mode</h2>
        <p className="hero-copy">
          Files stay in the browser. PDF playback uses PDF.js. PPTX playback uses a best-effort OOXML
          renderer with warnings for unsupported elements.
        </p>
        <label className="upload-card">
          <span>Drop a deck or click to choose</span>
          <strong>{loading ? "Importing..." : "Select .pdf or .pptx"}</strong>
          <input accept=".pdf,.pptx" hidden onChange={handleImport} type="file" />
        </label>
        {error ? <p className="status-card warning">{error}</p> : null}
      </article>

      <article className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent Decks</p>
            <h3>Jump back into rehearsal</h3>
          </div>
        </div>
        <div className="recent-list">
          {recentDecks.length === 0 ? <p className="muted-text">No deck imported yet.</p> : null}
          {recentDecks.map((deck) => (
            <button
              key={deck.id}
              className="recent-card"
              onClick={() => {
                setActiveDeckId(deck.id);
                navigate("/present");
              }}
              type="button"
            >
              <div>
                <strong>{deck.title}</strong>
                <p>
                  {deck.sourceType.toUpperCase()} · {deck.totalSlides} slides
                </p>
              </div>
              {deck.warnings.length > 0 ? <span className="warning-chip">{deck.warnings.length} warnings</span> : null}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
