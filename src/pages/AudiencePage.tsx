import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { SlideViewport } from "../components/SlideViewport";
import { getActiveDeckId, loadDeck } from "../services/deckStore";
import { readSessionState } from "../services/sessionState";
import { PresentationSyncChannel } from "../services/syncChannel";
import type { DeckDocument, PresentationSession } from "../types";

export function AudiencePage() {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<DeckDocument | null>(null);
  const [sourceFile, setSourceFile] = useState<Blob | undefined>();
  const [session, setSession] = useState<PresentationSession | null>(readSessionState());
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      setSourceFile(record.file);
    }

    boot();
    const channel = new PresentationSyncChannel();
    channel.subscribe((message) => {
      if (message.type === "SESSION_UPDATE") {
        setSession(message.session);
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

  if (!deck || !session) {
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
      <SlideViewport deck={deck} file={sourceFile} slide={deck.slides[session.currentSlide]} />
    </section>
  );
}
