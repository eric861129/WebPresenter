import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DeckShell } from "../components/DeckShell";

describe("DeckShell i18n", () => {
  it("switches between English and Chinese labels", () => {
    render(
      <MemoryRouter initialEntries={["/import"]}>
        <Routes>
          <Route element={<DeckShell />} path="/">
            <Route element={<div>content</div>} path="import" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Import Deck")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByText("匯入簡報")).toBeInTheDocument();
    expect(screen.getByText("以瀏覽器為核心的簡報控制中心")).toBeInTheDocument();
  });
});
