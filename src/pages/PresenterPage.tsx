import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [deck, setDeck] = useState<DeckDocument | null>(null);
  const [sourceFile, setSourceFile] = useState<Blob | undefined>();
  const [session, setSession] = useState<PresentationSession | null>(readSessionState());
  const [now, setNow] = useState(() => Date.now());
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remoteLink, setRemoteLink] = useState<string | null>(null);
  const syncRef = useRef<PresentationSyncChannel | null>(null);
  const remoteServerRef = useRef<PresenterRemoteServer | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    syncRef.current = new PresentationSyncChannel();
    return () => syncRef.current?.close();
  }, []);

  useEffect(() => {
    async function loadActiveDeck() {
      const deckId = getActiveDeckId();
      if (!deckId) {
        setError(t("presenter.noActiveDeck"));
        return;
      }

      const record = await loadDeck(deckId);
      if (!record) {
        setError(t("presenter.missingDeck"));
        return;
      }

      setDeck(record.deck);
      setSourceFile(record.file);
      setSession((currentSession) => currentSession ?? createSession(record.deck.id, "single"));
    }

    loadActiveDeck();
  }, [t]);

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

  useEffect(() => {
    function onFullscreenChange() {
      setIsStageFullscreen(document.fullscreenElement === stageRef.current);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
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
      setError(remoteError instanceof Error ? remoteError.message : t("presenter.remoteSetupFailed"));
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
        <p className="status-card warning">{error ?? t("presenter.loading")}</p>
        <Link className="primary-button" to="/import">
          {t("presenter.goImport")}
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
              <h2>{t("presenter.title")}</h2>
            </div>
            <div className="button-row">
              <button className="ghost-button" onClick={openAudienceWindow} type="button">
                {t("presenter.openAudience")}
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  if (document.fullscreenElement === stageRef.current) {
                    document.exitFullscreen().catch(() => undefined);
                    return;
                  }

                  stageRef.current?.requestFullscreen().catch(() => undefined);
                }}
                type="button"
              >
                {isStageFullscreen ? t("presenter.exitFullscreen") : t("presenter.enterFullscreen")}
              </button>
              <button className="primary-button" onClick={startRemotePairing} type="button">
                {t("presenter.pairRemote")}
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
          <div className="stage-card" ref={stageRef}>
            {session.blackout ? <div className="blackout-stage">{t("presenter.blackoutEnabled")}</div> : null}
            <SlideViewport deck={deck} file={sourceFile} slide={currentSlide} />
          </div>
        </article>

        <aside className="panel sidebar-panel">
          <div className="metric-grid">
            <div className="metric-card">
              <span>{t("presenter.slide")}</span>
              <strong>
                {session.currentSlide + 1}/{deck.totalSlides}
              </strong>
            </div>
            <div className="metric-card">
              <span>{t("presenter.elapsed")}</span>
              <strong>
                {t("presenter.elapsedValue", {
                  minutes: Math.floor(elapsedSeconds / 60),
                  seconds: elapsedSeconds % 60,
                })}
              </strong>
            </div>
            <div className="metric-card">
              <span>{t("presenter.remote")}</span>
              <strong>{t("presenter.connected", { count: session.connectedRemote.length || 0 })}</strong>
            </div>
          </div>

          <div className="button-row">
            <button
              className="ghost-button"
              disabled={session.currentSlide === 0}
              onClick={() => goToSlide(Math.max(0, session.currentSlide - 1))}
              type="button"
            >
              {t("presenter.previous")}
            </button>
            <button
              className="ghost-button"
              disabled={session.currentSlide === deck.totalSlides - 1}
              onClick={() => goToSlide(Math.min(deck.totalSlides - 1, session.currentSlide + 1))}
              type="button"
            >
              {t("presenter.next")}
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
              {session.blackout ? t("presenter.disableBlackout") : t("presenter.enableBlackout")}
            </button>
          </div>

          <div className="notes-card">
            <p className="eyebrow">{t("presenter.notesEyebrow")}</p>
            <h3>{currentSlide.notes ? t("presenter.notesAvailable") : t("presenter.notesEmptyTitle")}</h3>
            <p>{currentSlide.notes ?? t("presenter.notesEmptyBody")}</p>
          </div>

          {nextSlide ? (
            <div className="preview-card">
              <p className="eyebrow">{t("presenter.nextSlide")}</p>
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
            {t("presenter.resetSession")}
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
