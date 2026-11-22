
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import {
  Zap,
  Sun,
  Moon,
  ScanText,
  House,
  UsersRound,
  History,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  {
    path: "/",
    label: "Home",
    Icon: House,
    end: true,
  },
  {
    path: "/scan",
    label: "Scan Bill",
    Icon: ScanText,
  },
  {
    path: "/split",
    label: "Split Bill",
    Icon: UsersRound,
  },
  {
    path: "/history",
    label: "History",
    Icon: History,
  },
];

export default function Navbar({
  theme,
  toggleTheme,
}) {
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu when navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close menu with Escape.
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  return (
    <header className="navbar neo-navbar">
      <div className="nav-inner neo-nav-inner">

        {/* BRAND */}
        <Link
          to="/"
          className="brand neo-brand"
          aria-label="SplitMate Home"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-logo neo-brand-logo">
            <Zap
              size={21}
              fill="currentColor"
              aria-hidden="true"
            />
          </span>

          <span className="neo-brand-text">
            SplitMate
            <span className="neo-brand-dot">.</span>
          </span>
        </Link>

        {/* DESKTOP AND MOBILE NAVIGATION */}
        <nav
          id="splitmate-main-navigation"
          className={`nav-actions neo-nav-actions ${
            menuOpen ? "neo-menu-open" : ""
          }`}
          aria-label="Main navigation"
        >
          {navItems.map(
            ({ path, label, Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `nav-link neo-nav-link ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <Icon
                  size={19}
                  aria-hidden="true"
                />

                <span>{label}</span>
              </NavLink>
            )
          )}
        </nav>

        {/* RIGHT ACTIONS */}
        <div className="neo-nav-controls">

          {/* THEME TOGGLE */}
          <button
            type="button"
            className="theme-button neo-theme-button"
            onClick={toggleTheme}
            aria-label={
              theme === "light"
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
            title={
              theme === "light"
                ? "Dark mode"
                : "Light mode"
            }
          >
            {theme === "light" ? (
              <Moon size={20} />
            ) : (
              <Sun size={20} />
            )}
          </button>

          {/* MOBILE MENU TOGGLE */}
          <button
            type="button"
            className="neo-mobile-menu-button"
            onClick={() =>
              setMenuOpen((current) => !current)
            }
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="splitmate-main-navigation"
          >
            {menuOpen ? (
              <X size={23} />
            ) : (
              <Menu size={23} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
