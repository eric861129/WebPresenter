import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function DeckShell() {
  const location = useLocation();
  const { i18n, t } = useTranslation();

  const links = [
    { to: "/import", label: t("shell.nav.import") },
    { to: "/present", label: t("shell.nav.presenter") },
    { to: "/audience", label: t("shell.nav.audience") },
    { to: "/remote", label: t("shell.nav.remote") },
  ];

  if (location.pathname === "/audience") {
    return (
      <main className="audience-shell">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WebPresenter</p>
          <h1>{t("shell.subtitle")}</h1>
        </div>
        <div className="nav-group">
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
          <div className="nav-links">
            <button
              className={i18n.language === "zh-TW" ? "nav-link active" : "nav-link"}
              onClick={() => i18n.changeLanguage("zh-TW")}
              type="button"
            >
              {t("shell.languageZh")}
            </button>
            <button
              className={i18n.language.startsWith("en") ? "nav-link active" : "nav-link"}
              onClick={() => i18n.changeLanguage("en")}
              type="button"
            >
              {t("shell.languageEn")}
            </button>
          </div>
        </div>
      </header>
      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
