import { Link, Outlet, useLocation } from "react-router-dom";

const links = [
  { to: "/import", label: "Import Deck" },
  { to: "/present", label: "Presenter" },
  { to: "/audience", label: "Audience" },
  { to: "/remote", label: "Remote" },
];

export function DeckShell() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WebPresenter</p>
          <h1>Browser-first presentation control room</h1>
        </div>
        <nav className="nav-links">
          {links.map((link) => (
            <Link
              key={link.to}
              className={location.pathname === link.to ? "nav-link active" : "nav-link"}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
