import Peer, { type DataConnection } from "peerjs";

import type { PresentationSession, RemoteCommand } from "../types";

type SessionPayload = {
  session: PresentationSession;
  notes?: string;
  totalSlides: number;
  title: string;
};

type PresenterOptions = {
  token: string;
  onCommand: (command: RemoteCommand, remoteId: string) => void;
};

export class PresenterRemoteServer {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private options: PresenterOptions;
  private onStatus?: (connectedIds: string[]) => void;

  constructor(options: PresenterOptions) {
    this.options = options;
  }

  async start() {
    return new Promise<string>((resolve, reject) => {
      this.peer = new Peer();
      this.peer.once("open", (peerId) => resolve(peerId));
      this.peer.once("error", reject);
      this.peer.on("connection", (connection) => {
        const token = connection.metadata?.token;
        if (token !== this.options.token) {
          connection.close();
          return;
        }

        this.connections.set(connection.peer, connection);
        this.onStatus?.(Array.from(this.connections.keys()));

        connection.on("data", (message) => {
          this.options.onCommand(message as RemoteCommand, connection.peer);
        });

        connection.on("close", () => {
          this.connections.delete(connection.peer);
          this.onStatus?.(Array.from(this.connections.keys()));
        });
      });
    });
  }

  subscribeStatus(handler: (connectedIds: string[]) => void) {
    this.onStatus = handler;
    handler(Array.from(this.connections.keys()));
  }

  broadcastState(payload: SessionPayload) {
    this.connections.forEach((connection) => {
      connection.send({
        type: "SYNC_STATE",
        ...payload,
      } satisfies RemoteCommand);
    });
  }

  stop() {
    this.connections.forEach((connection) => connection.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

type RemoteClientOptions = {
  peerId: string;
  token: string;
  onState: (payload: RemoteCommand & { type: "SYNC_STATE" }) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class MobileRemoteClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private retryTimer: number | null = null;
  private disposed = false;
  private suppressReconnect = false;
  private options: RemoteClientOptions;

  constructor(options: RemoteClientOptions) {
    this.options = options;
  }

  connect() {
    this.disposed = false;
    this.suppressReconnect = false;
    this.peer = new Peer();
    this.peer.on("error", () => {
      if (this.disposed || this.suppressReconnect) {
        return;
      }

      this.options.onClose?.();
      this.scheduleReconnect();
    });
    this.peer.once("open", () => {
      this.connection = this.peer?.connect(this.options.peerId, {
        reliable: true,
        metadata: {
          token: this.options.token,
        },
      }) ?? null;

      this.connection?.on("open", () => {
        this.options.onOpen?.();
        this.send({ type: "SYNC_REQUEST" });
      });

      this.connection?.on("data", (payload) => {
        if ((payload as RemoteCommand).type === "SYNC_STATE") {
          this.options.onState(payload as RemoteCommand & { type: "SYNC_STATE" });
        }
      });

      this.connection?.on("close", () => {
        if (this.disposed || this.suppressReconnect) {
          return;
        }

        this.options.onClose?.();
        this.scheduleReconnect();
      });

      this.connection?.on("error", () => {
        if (this.disposed || this.suppressReconnect) {
          return;
        }

        this.options.onClose?.();
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect() {
    if (this.disposed || this.suppressReconnect) {
      return;
    }

    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
    }

    this.retryTimer = window.setTimeout(() => {
      this.suppressReconnect = true;
      this.connection?.close();
      this.peer?.destroy();
      this.connection = null;
      this.peer = null;
      this.suppressReconnect = false;
      this.connect();
    }, 5000);
  }

  send(command: RemoteCommand) {
    this.connection?.send(command);
  }

  dispose() {
    this.disposed = true;
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.suppressReconnect = true;
    this.connection?.close();
    this.peer?.destroy();
    this.connection = null;
    this.peer = null;
    this.suppressReconnect = false;
  }
}

export function buildRemoteLink(peerId: string, token: string) {
  const url = new URL(window.location.href);
  url.hash = `/remote?peerId=${encodeURIComponent(peerId)}&token=${encodeURIComponent(token)}`;
  return url.toString();
}
