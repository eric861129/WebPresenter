import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RemotePage } from "../pages/RemotePage";

describe("RemotePage", () => {
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
});
