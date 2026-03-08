import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { MobileRemoteClient } from "../services/remoteControl";
import type { PresentationSession, RemoteCommand } from "../types";

const REMOTE_QUERY_KEY = "webpresenter.remoteQuery";

type SyncState = {
  session: PresentationSession | null;
  notes?: string;
  totalSlides: number;
  title: string;
};

export function RemotePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({
    session: null,
    totalSlides: 0,
    title: "",
  });
  const [gotoValue, setGotoValue] = useState("");

  useEffect(() => {
    const incomingPeerId = searchParams.get("peerId");
    const incomingToken = searchParams.get("token");

    if (incomingPeerId && incomingToken) {
      localStorage.setItem(
        REMOTE_QUERY_KEY,
        JSON.stringify({
          peerId: incomingPeerId,
          token: incomingToken,
        }),
      );
    }

    const fallback = localStorage.getItem(REMOTE_QUERY_KEY);
    const parsed = fallback ? (JSON.parse(fallback) as { peerId: string; token: string }) : null;
    const peerId = incomingPeerId ?? parsed?.peerId;
    const token = incomingToken ?? parsed?.token;

    if (!peerId || !token) {
      return;
    }

    const client = new MobileRemoteClient({
      peerId,
      token,
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onState: (payload) => {
        setSyncState({
          session: payload.session,
          notes: payload.notes,
          totalSlides: payload.totalSlides,
          title: payload.title,
        });
      },
    });

    client.connect();

    function send(command: RemoteCommand) {
      client.send(command);
    }

    (window as Window & { webPresenterRemoteSend?: typeof send }).webPresenterRemoteSend = send;

    return () => {
      client.dispose();
    };
  }, [searchParams]);

  function send(command: RemoteCommand) {
    (window as Window & { webPresenterRemoteSend?: (next: RemoteCommand) => void }).webPresenterRemoteSend?.(command);
  }

  const session = syncState.session;

  return (
    <section className="remote-layout">
      <article className="panel remote-panel">
        <p className="eyebrow">{t("remote.eyebrow")}</p>
        <h2>{syncState.title || t("remote.waitingTitle")}</h2>
        <p className={connected ? "status-card success" : "status-card"}>
          {connected ? t("remote.connected") : t("remote.waiting")}
        </p>
        <div className="metric-grid remote-metrics">
          <div className="metric-card">
            <span>{t("remote.slide")}</span>
            <strong>{session ? `${session.currentSlide + 1}/${syncState.totalSlides}` : "--"}</strong>
          </div>
          <div className="metric-card">
            <span>{t("remote.blackout")}</span>
            <strong>{session?.blackout ? t("remote.blackoutOn") : t("remote.blackoutOff")}</strong>
          </div>
          <div className="metric-card">
            <span>{t("remote.status")}</span>
            <strong>{connected ? t("remote.live") : t("remote.idle")}</strong>
          </div>
        </div>
        <div className="remote-controls">
          <button className="ghost-button remote-button" onClick={() => send({ type: "PREV" })} type="button">
            {t("remote.previous")}
          </button>
          <button className="primary-button remote-button" onClick={() => send({ type: "NEXT" })} type="button">
            {t("remote.next")}
          </button>
          <button className="ghost-button remote-button" onClick={() => send({ type: "TOGGLE_BLACKOUT" })} type="button">
            {t("remote.toggleBlackout")}
          </button>
        </div>
        <form
          className="goto-form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextIndex = Number(gotoValue) - 1;
            if (!Number.isNaN(nextIndex)) {
              send({ type: "GOTO", index: nextIndex });
            }
          }}
        >
          <input
            className="text-input"
            inputMode="numeric"
            onChange={(event) => setGotoValue(event.target.value)}
            placeholder={t("remote.jumpPlaceholder")}
            value={gotoValue}
          />
          <button className="ghost-button" type="submit">
            {t("common.go")}
          </button>
        </form>
      </article>

      <article className="panel notes-panel">
        <p className="eyebrow">{t("remote.notesEyebrow")}</p>
        <h3>{syncState.notes ? t("remote.notesTitle") : t("remote.notesEmptyTitle")}</h3>
        <p>{syncState.notes ?? t("remote.notesEmptyBody")}</p>
      </article>
    </section>
  );
}
