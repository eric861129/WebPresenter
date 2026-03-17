import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendSpy = vi.fn();

vi.mock("../services/remoteControl", () => {
  return {
    MobileRemoteClient: class {
      private options: {
        onOpen?: () => void;
        onState: (payload: {
          type: "SYNC_STATE";
          session: {
            sessionId: string;
            deckId: string;
            currentSlide: number;
            blackout: boolean;
            mode: "single" | "dual";
            connectedRemote: string[];
            startedAt: number;
          };
          notes?: string;
          totalSlides: number;
          title: string;
        }) => void;
      };

      constructor(options: {
        onOpen?: () => void;
        onState: (payload: {
          type: "SYNC_STATE";
          session: {
            sessionId: string;
            deckId: string;
            currentSlide: number;
            blackout: boolean;
            mode: "single" | "dual";
            connectedRemote: string[];
            startedAt: number;
          };
          notes?: string;
          totalSlides: number;
          title: string;
        }) => void;
      }) {
        this.options = options;
      }

      connect() {
        this.options.onOpen?.();
        this.options.onState({
          type: "SYNC_STATE",
          session: {
            sessionId: "session-1",
            deckId: "deck-1",
            currentSlide: 1,
            blackout: false,
            mode: "single",
            connectedRemote: [],
            startedAt: Date.now(),
          },
          notes: "Remember the demo flow",
          totalSlides: 8,
          title: "Interview Deck",
        });
      }

      send(command: unknown) {
        sendSpy(command);
      }

      dispose() {
        return undefined;
      }
    },
  };
});

import { RemotePage } from "../pages/RemotePage";

describe("RemotePage", () => {
  beforeEach(() => {
    sendSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders waiting state without presenter params", () => {
    render(
      <MemoryRouter initialEntries={["/remote"]}>
        <Routes>
          <Route element={<RemotePage />} path="/remote" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Waiting for presenter connection")).toBeInTheDocument();
    expect(screen.getByText("No notes available")).toBeInTheDocument();
  });

  it("sends a goto command from the jump form", () => {
    render(
      <MemoryRouter initialEntries={["/remote?peerId=peer-1&token=token-1"]}>
        <Routes>
          <Route element={<RemotePage />} path="/remote" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Jump to slide #"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(sendSpy).toHaveBeenCalledWith({
      type: "GOTO",
      index: 4,
    });
  });
});
