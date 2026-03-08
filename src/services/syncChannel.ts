import type { SyncMessage } from "../types";

const CHANNEL_NAME = "webpresenter.presentation";

type MessageHandler = (message: SyncMessage) => void;

export class PresentationSyncChannel {
  private channel: BroadcastChannel;

  constructor(channel?: BroadcastChannel) {
    this.channel = channel ?? new BroadcastChannel(CHANNEL_NAME);
  }

  post(message: SyncMessage) {
    this.channel.postMessage(message);
  }

  subscribe(handler: MessageHandler) {
    this.channel.addEventListener("message", (event) => {
      handler(event.data as SyncMessage);
    });
  }

  close() {
    this.channel.close();
  }
}
