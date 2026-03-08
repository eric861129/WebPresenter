import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { RemoteQrModal } from "../components/RemoteQrModal";
import { SlideViewport } from "../components/SlideViewport";
import { buildQrCodeDataUrl } from "../services/qrCode";
import { buildRemoteLink, PresenterRemoteServer } from "../services/remoteControl";
import { getActiveDeckId, loadDeck } from "../services/deckStore";
import { clearSessionState, readSessionState, writeSessionState } from "../services/sessionState";
import { PresentationSyncChannel } from "../services/syncChannel";
import type { DeckDocument, PresentationMode, PresentationSession, RemoteCommand } from "../types";

function createSession(deckId: string, mode: PresentationMode): PresentationSession {
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

export function PresenterPage() {
  const [deck, setDeck] = useState<DeckDocument | null>(null);
  const [sourceFile, setSourceFile] = useState<Blob | undefined>();
  const [session, setSession] = useState<PresentationSession | null>(readSessionState());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remoteLink, setRemoteLink] = useState<string | null>(null);
  const syncRef = useRef<PresentationSyncChannel | null>(null);
  const remoteServerRef = useRef<PresenterRemoteServer | null>(null);

  useEffect(() => {
    syncRef.current = new PresentationSyncChannel();
    return () => syncRef.current?.close();
  }, []);

  useEffect(() => {
    async function loadActiveDeck() {
      const deckId = getActiveDeckId();
      if (!deckId) {
        setError("No active deck. Import a PDF or PPTX first.");
        return;
      }

      const record = await loadDeck(deckId);
      if (!record) {
        setError("Deck not found in local storage.");
        return;
      }

      setDeck(record.deck);
      setSourceFile(record.file);
      setSession((currentSession) => currentSession ?? createSession(record.deck.id, "single"));
    }

    loadActiveDeck();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    writeSessionState(session);
    syncRef.current?.post({
      type: "SESSION_UPDATE",
      session,
    });
  }, [session]);

  useEffect(() => {
    return () => {
      remoteServerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function goToSlide(index: number) {
    if (!session || !deck) {
      return;
    }

    const nextSession = {
      ...session,
      currentSlide: index,
    };

    setSession(nextSession);
    remoteServerRef.current?.broadcastState({
      session: nextSession,
      notes: deck.slides[index]?.notes,
      totalSlides: deck.totalSlides,
      title: deck.title,
    });
  }

  function applyRemoteCommand(command: RemoteCommand) {
    if (!deck || !session) {
      return;
    }

    if (command.type === "SYNC_REQUEST") {
      remoteServerRef.current?.broadcastState({
        session,
        notes: deck.slides[session.currentSlide]?.notes,
        totalSlides: deck.totalSlides,
        title: deck.title,
      });
      return;
    }

    if (command.type === "NEXT") {
      goToSlide(Math.min(deck.totalSlides - 1, session.currentSlide + 1));
      return;
    }

    if (command.type === "PREV") {
      goToSlide(Math.max(0, session.currentSlide - 1));
      return;
    }

    if (command.type === "GOTO") {
      goToSlide(Math.max(0, Math.min(deck.totalSlides - 1, command.index)));
      return;
    }

    if (command.type === "TOGGLE_BLACKOUT") {
      setSession({
        ...session,
        blackout: !session.blackout,
      });
    }
  }

  async function startRemotePairing() {
    if (!deck || !session) {
      return;
    }

    setQrOpen(true);

    if (remoteServerRef.current) {
      return;
    }

    const token = crypto.randomUUID();
    const remoteServer = new PresenterRemoteServer({
      token,
      onCommand: (command) => applyRemoteCommand(command),
    });

    remoteServer.subscribeStatus((connectedIds) => {
      setSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              connectedRemote: connectedIds,
            }
          : currentSession,
      );
    });

    remoteServerRef.current = remoteServer;

    try {
      const nextPeerId = await remoteServer.start();
      const nextLink = buildRemoteLink(nextPeerId, token);
      setPeerId(nextPeerId);
      setRemoteLink(nextLink);
      setQrDataUrl(await buildQrCodeDataUrl(nextLink));
      remoteServer.broadcastState({
        session,
        notes: deck.slides[session.currentSlide]?.notes,
        totalSlides: deck.totalSlides,
        title: deck.title,
      });
    } catch (remoteError) {
      setError(remoteError instanceof Error ? remoteError.message : "Remote setup failed");
    }
  }

  function openAudienceWindow() {
    if (!deck) {
      return;
    }

    const nextSession = createSession(deck.id, "dual");
    setSession(nextSession);
    writeSessionState(nextSession);
    window.open(`${window.location.origin}${window.location.pathname}#/audience`, "webpresenter-audience");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!deck || !session) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setSession({
          ...session,
          currentSlide: Math.min(deck.totalSlides - 1, session.currentSlide + 1),
        });
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setSession({
          ...session,
          currentSlide: Math.max(0, session.currentSlide - 1),
        });
      }

      if (event.key.toLowerCase() === "b") {
        setSession({
          ...session,
          blackout: !session.blackout,
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deck, session]);

  useEffect(() => {
    if (!deck || !session) {
      return;
    }

    remoteServerRef.current?.broadcastState({
      session,
      notes: deck.slides[session.currentSlide]?.notes,
      totalSlides: deck.totalSlides,
      title: deck.title,
    });
  }, [deck, session]);

  if (!deck || !session) {
    return (
      <section className="panel">
        <p className="status-card warning">{error ?? "Loading presenter console..."}</p>
        <Link className="primary-button" to="/import">
          Go to import
        </Link>
      </section>
    );
  }

  const currentSlide = deck.slides[session.currentSlide];
  const nextSlide = deck.slides[session.currentSlide + 1];
  const elapsedSeconds = Math.floor((now - session.startedAt) / 1000);

  return (
    <>
      <section className="presenter-grid">
        <article className="panel stage-panel">
          <div className="stage-header">
            <div>
              <p className="eyebrow">{deck.title}</p>
              <h2>Presenter console</h2>
            </div>
            <div className="button-row">
              <button className="ghost-button" onClick={openAudienceWindow} type="button">
                Open audience window
              </button>
              <button
                className="ghost-button"
                onClick={() => document.documentElement.requestFullscreen().catch(() => undefined)}
                type="button"
              >
                Single-screen fullscreen
              </button>
              <button className="primary-button" onClick={startRemotePairing} type="button">
                Pair phone remote
              </button>
            </div>
          </div>
          {deck.warnings.length > 0 ? (
            <div className="warning-list">
              {deck.warnings.map((warning) => (
                <p key={warning} className="status-card warning">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
          <div className="stage-card">
            {session.blackout ? <div className="blackout-stage">Blackout enabled</div> : null}
            <SlideViewport deck={deck} file={sourceFile} slide={currentSlide} />
          </div>
        </article>

        <aside className="panel sidebar-panel">
          <div className="metric-grid">
            <div className="metric-card">
              <span>Slide</span>
              <strong>
                {session.currentSlide + 1}/{deck.totalSlides}
              </strong>
            </div>
            <div className="metric-card">
              <span>Elapsed</span>
              <strong>
                {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
              </strong>
            </div>
            <div className="metric-card">
              <span>Remote</span>
              <strong>{session.connectedRemote.length || 0} connected</strong>
            </div>
          </div>

          <div className="button-row">
            <button
              className="ghost-button"
              disabled={session.currentSlide === 0}
              onClick={() => goToSlide(Math.max(0, session.currentSlide - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="ghost-button"
              disabled={session.currentSlide === deck.totalSlides - 1}
              onClick={() => goToSlide(Math.min(deck.totalSlides - 1, session.currentSlide + 1))}
              type="button"
            >
              Next
            </button>
            <button
              className={session.blackout ? "primary-button danger" : "ghost-button"}
              onClick={() =>
                setSession({
                  ...session,
                  blackout: !session.blackout,
                })
              }
              type="button"
            >
              {session.blackout ? "Disable blackout" : "Enable blackout"}
            </button>
          </div>

          <div className="notes-card">
            <p className="eyebrow">Current Notes</p>
            <h3>{currentSlide.notes ? "Speaker notes available" : "No notes on this slide"}</h3>
            <p>{currentSlide.notes ?? "PDF decks do not expose speaker notes in v1."}</p>
          </div>

          {nextSlide ? (
            <div className="preview-card">
              <p className="eyebrow">Next Slide</p>
              <SlideViewport className="preview-frame" deck={deck} file={sourceFile} slide={nextSlide} />
            </div>
          ) : null}

          <button
            className="ghost-button"
            onClick={() => {
              clearSessionState();
              setSession(createSession(deck.id, "single"));
            }}
            type="button"
          >
            Reset session
          </button>
        </aside>
      </section>

      <RemoteQrModal
        onClose={() => setQrOpen(false)}
        open={qrOpen}
        peerId={peerId}
        qrDataUrl={qrDataUrl}
        remoteLink={remoteLink}
      />
    </>
  );
}
