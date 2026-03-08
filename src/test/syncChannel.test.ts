import { describe, expect, it } from "vitest";

import { PresentationSyncChannel } from "../services/syncChannel";
import type { SyncMessage } from "../types";

class FakeBroadcastChannel {
  static peers: FakeBroadcastChannel[] = [];
  name: string;
  listeners = new Set<(event: MessageEvent) => void>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.peers.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  postMessage(message: SyncMessage) {
    for (const peer of FakeBroadcastChannel.peers) {
      if (peer.name === this.name && peer !== this) {
        peer.listeners.forEach((listener) => listener({ data: message } as MessageEvent));
      }
    }
  }

  close() {
    FakeBroadcastChannel.peers = FakeBroadcastChannel.peers.filter((peer) => peer !== this);
  }
}

describe("PresentationSyncChannel", () => {
  it("broadcasts session updates across listeners", () => {
    const received: SyncMessage[] = [];
    const a = new PresentationSyncChannel(
      new FakeBroadcastChannel("webpresenter.presentation") as unknown as BroadcastChannel,
    );
    const b = new PresentationSyncChannel(
      new FakeBroadcastChannel("webpresenter.presentation") as unknown as BroadcastChannel,
    );

    b.subscribe((message) => {
      received.push(message);
    });

    a.post({
      type: "DECK_ACTIVATED",
      deckId: "deck-1",
    });

    expect(received).toEqual([
      {
        type: "DECK_ACTIVATED",
        deckId: "deck-1",
      },
    ]);
  });
});
