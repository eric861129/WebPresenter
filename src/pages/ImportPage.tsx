import { startTransition, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { importDeckFromFile } from "../services/deckImport";
import { clearStoredDecks, loadRecentDecks, persistDeck, setActiveDeckId } from "../services/deckStore";
import { clearSessionState } from "../services/sessionState";
import type { DeckRecordSummary } from "../types";

export function ImportPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  async function handleClearDecks() {
    await clearStoredDecks();
    clearSessionState();
    setRecentDecks([]);
    setError(null);
  }

  return (
    <section className="import-grid">
      <article className="panel hero-panel">
        <p className="eyebrow">{t("import.eyebrow")}</p>
        <h2>{t("import.title")}</h2>
        <p className="hero-copy">{t("import.copy")}</p>
        <label className="upload-card">
          <span>{t("import.uploadHint")}</span>
          <strong>{loading ? t("import.uploadLoading") : t("import.uploadIdle")}</strong>
          <input accept=".pdf,.pptx" hidden onChange={handleImport} type="file" />
        </label>
        <div className="button-row import-actions">
          <button className="ghost-button" onClick={handleClearDecks} type="button">
            {t("import.clearDecks")}
          </button>
        </div>
        {error ? <p className="status-card warning">{error}</p> : null}
      </article>

      <article className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("import.recentEyebrow")}</p>
            <h3>{t("import.recentTitle")}</h3>
          </div>
        </div>
        <div className="recent-list">
          {recentDecks.length === 0 ? <p className="muted-text">{t("import.empty")}</p> : null}
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
                <p>{t("import.deckMeta", { type: deck.sourceType.toUpperCase(), count: deck.totalSlides })}</p>
              </div>
              {deck.warnings.length > 0 ? (
                <span className="warning-chip">{t("import.warnings", { count: deck.warnings.length })}</span>
              ) : null}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
