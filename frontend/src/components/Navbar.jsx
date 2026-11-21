
import { Link, NavLink } from "react-router-dom";
import {
  ReceiptText,
  Sun,
  Moon,
  ScanText,
} from "lucide-react";

function Navbar({ theme, toggleTheme }) {
  return (
    <header className="navbar">
      <div className="nav-inner">

        {/* SplitMate Logo */}
        <Link to="/" className="brand">
          <span className="brand-logo">
            <ReceiptText size={22} />
          </span>

          <span>
            Split<span className="accent">Mate</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="nav-actions" aria-label="Main navigation">

          <NavLink to="/" end>
            Home
          </NavLink>

          <NavLink to="/scan">
            <ScanText size={18} />
            Scan Bill
          </NavLink>

          <NavLink to="/split">
            Split Bill
          </NavLink>

          <NavLink to="/history">
  Bill History
</NavLink>

          {/* Light / Dark Theme Toggle */}
          <button
            type="button"
            className="theme-button"
            onClick={toggleTheme}
            aria-label={
              theme === "light"
                ? "Switch to dark mode"
                : "Switch to light mode"
            }
            title="Toggle theme"
          >
            {theme === "light" ? (
              <Moon size={20} />
            ) : (
              <Sun size={20} />
            )}
          </button>

        </nav>
      </div>
    </header>
  );
}

export default Navbar;
