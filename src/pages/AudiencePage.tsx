import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SlideViewport } from "../components/SlideViewport";
import { getActiveDeckId, loadDeck } from "../services/deckStore";
import { readSessionState } from "../services/sessionState";
import { PresentationSyncChannel } from "../services/syncChannel";
import type { DeckDocument, PresentationSession } from "../types";

export function AudiencePage() {
  const [deck, setDeck] = useState<DeckDocument | null>(null);
  const [sourceFile, setSourceFile] = useState<Blob | undefined>();
  const [session, setSession] = useState<PresentationSession | null>(readSessionState());

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

  if (!deck || !session) {
    return (
      <section className="panel">
        <p className="status-card">Audience view is waiting for an active presentation session.</p>
        <Link className="primary-button" to="/present">
          Open presenter
        </Link>
      </section>
    );
  }

  return (
    <section className="audience-screen">
      {session.blackout ? <div className="blackout-stage audience-blackout" /> : null}
      <SlideViewport deck={deck} file={sourceFile} slide={deck.slides[session.currentSlide]} />
    </section>
  );
}
