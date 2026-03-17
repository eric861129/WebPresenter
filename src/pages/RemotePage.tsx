import { type FormEvent, useEffect, useState } from "react";
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
  const [jumpValue, setJumpValue] = useState("");
  const [syncState, setSyncState] = useState<SyncState>({
    session: null,
    totalSlides: 0,
    title: "",
  });

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

    let parsed: { peerId: string; token: string } | null = null;

    try {
      const fallback = localStorage.getItem(REMOTE_QUERY_KEY);
      parsed = fallback ? (JSON.parse(fallback) as { peerId: string; token: string }) : null;
    } catch {
      localStorage.removeItem(REMOTE_QUERY_KEY);
    }

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
      (window as Window & { webPresenterRemoteSend?: typeof send }).webPresenterRemoteSend = undefined;
      client.dispose();
    };
  }, [searchParams]);

  function send(command: RemoteCommand) {
    (window as Window & { webPresenterRemoteSend?: (next: RemoteCommand) => void }).webPresenterRemoteSend?.(command);
  }

  function submitJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!syncState.session || syncState.totalSlides <= 0) {
      return;
    }

    const requestedSlide = Number(jumpValue);
    if (!Number.isFinite(requestedSlide)) {
      return;
    }

    const normalizedSlide = Math.min(syncState.totalSlides, Math.max(1, Math.trunc(requestedSlide)));
    send({
      type: "GOTO",
      index: normalizedSlide - 1,
    });
    setJumpValue(String(normalizedSlide));
  }

  const session = syncState.session;

  return (
    <section className="remote-screen">
      <article className="remote-panel remote-single">
        <p className="eyebrow">{t("remote.eyebrow")}</p>
        <h2>{syncState.title || t("remote.waitingTitle")}</h2>
        <p className={connected ? "status-card success" : "status-card"}>
          {connected ? t("remote.connected") : t("remote.waiting")}
        </p>
        {session ? (
          <p className="status-card">
            {t("remote.slide")} {session.currentSlide + 1}/{syncState.totalSlides} · {t("remote.blackout")}{" "}
            {session.blackout ? t("remote.blackoutOn") : t("remote.blackoutOff")}
          </p>
        ) : null}
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
        <form className="jump-form" onSubmit={submitJump}>
          <input
            className="remote-input"
            inputMode="numeric"
            max={syncState.totalSlides || undefined}
            min={1}
            onChange={(event) => setJumpValue(event.target.value)}
            placeholder={t("remote.jumpPlaceholder")}
            type="number"
            value={jumpValue}
          />
          <button className="ghost-button" disabled={!session || syncState.totalSlides === 0} type="submit">
            {t("common.go")}
          </button>
        </form>
        <div className="notes-panel remote-notes">
          <p className="eyebrow">{t("remote.notesEyebrow")}</p>
          <h3>{syncState.notes ? t("remote.notesTitle") : t("remote.notesEmptyTitle")}</h3>
          <p>{syncState.notes ?? t("remote.notesEmptyBody")}</p>
        </div>
      </article>
    </section>
  );
}
