
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import ScanBill from "./pages/ScanBill";
import SplitBill from "./pages/SplitBill";
import Settlement from "./pages/Settlement";
import BillHistory from "./pages/BillHistory";
import BillDetail from "./pages/BillDetail";

function App() {
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem(
        "splitmate-theme"
      ) || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    localStorage.setItem(
      "splitmate-theme",
      theme
    );
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light"
        ? "dark"
        : "light"
    );
  };

  return (
    <>
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="container">
        <Routes>
          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/scan"
            element={<ScanBill />}
          />

          <Route
            path="/split"
            element={<SplitBill />}
          />

          <Route
            path="/settlement"
            element={<Settlement />}
          />

          <Route
            path="/history"
            element={<BillHistory />}
          />

          <Route
            path="/history/:id"
            element={<BillDetail />}
          />
        </Routes>
      </main>
    </>
  );
}

export default App;
