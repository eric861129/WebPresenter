import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { SlideViewport } from "../components/SlideViewport";
import { getActiveDeckId, loadDeck } from "../services/deckStore";
import { readSessionState, validateSessionForDeck } from "../services/sessionState";
import { PresentationSyncChannel } from "../services/syncChannel";
import type { DeckDocument, PresentationSession } from "../types";

export function AudiencePage() {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<DeckDocument | null>(null);
  const [sourceFile, setSourceFile] = useState<Blob | undefined>();
  const [session, setSession] = useState<PresentationSession | null>(readSessionState());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const deckRef = useRef<DeckDocument | null>(null);

  useEffect(() => {
    async function boot() {
      const deckId = getActiveDeckId();
      if (!deckId) {
        return;
      }

      const record = await loadDeck(deckId);
      if (!record) {
        return;
      }

      setDeck(record.deck);
      deckRef.current = record.deck;
      setSourceFile(record.file);
      setSession(validateSessionForDeck(readSessionState(), record.deck));
    }

    boot();
    const channel = new PresentationSyncChannel();
    channel.subscribe((message) => {
      if (message.type === "SESSION_UPDATE") {
        const currentDeck = deckRef.current;
        setSession(currentDeck ? validateSessionForDeck(message.session, currentDeck) : message.session);
      }
    });

    return () => channel.close();
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.documentElement.requestFullscreen().catch(() => undefined);

    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const currentSlide = deck && session ? deck.slides[session.currentSlide] : null;

  if (!deck || !session || !currentSlide) {
    return (
      <section className="panel">
        <p className="status-card">{t("audience.waiting")}</p>
        <Link className="primary-button" to="/present">
          {t("audience.openPresenter")}
        </Link>
      </section>
    );
  }

  return (
    <section className="audience-screen">
      <div className="audience-toolbar">
        <button
          className="ghost-button"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => undefined);
              return;
            }

            document.documentElement.requestFullscreen().catch(() => undefined);
          }}
          type="button"
        >
          {isFullscreen ? t("audience.exitFullscreen") : t("audience.enterFullscreen")}
        </button>
      </div>
      {session.blackout ? <div className="blackout-stage audience-blackout" /> : null}
      <SlideViewport deck={deck} file={sourceFile} slide={currentSlide} />
    </section>
  );
}
