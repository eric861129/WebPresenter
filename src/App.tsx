import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { DeckShell } from "./components/DeckShell";
import { AudiencePage } from "./pages/AudiencePage";
import { ImportPage } from "./pages/ImportPage";
import { PresenterPage } from "./pages/PresenterPage";
import { RemotePage } from "./pages/RemotePage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<DeckShell />} path="/">
          <Route element={<Navigate replace to="/import" />} index />
          <Route element={<ImportPage />} path="import" />
          <Route element={<PresenterPage />} path="present" />
          <Route element={<AudiencePage />} path="audience" />
          <Route element={<RemotePage />} path="remote" />
        </Route>
      </Routes>
    </HashRouter>
  );
}
