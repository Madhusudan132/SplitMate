
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  History,
  ReceiptText,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Trash2,
  Search,
  SlidersHorizontal,
  X,
  Wallet,
  Users,
  Sparkles,
  WifiOff,
} from "lucide-react";

import { historyApi } from "../api/history";

// ==========================================
// HELPERS
// ==========================================

function money(paise) {
  const value = Number(paise) || 0;

  return `₹${(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ==========================================
// BILL HISTORY PAGE
// ==========================================

export default function BillHistory() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  // ==========================================
  // LOAD SAVED BILLS
  // ==========================================

  async function loadBills() {
    setLoading(true);
    setError("");
    setLoadError(false);

    try {
      const result = await historyApi.list();

      setBills(
        Array.isArray(result.bills)
          ? result.bills
          : []
      );
    } catch (err) {
      setLoadError(true);

      setError(
        err.message || "Unable to load bill history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
  }, []);

  // ==========================================
  // DELETE SAVED BILL
  // ==========================================

  async function deleteBill(bill) {
    const confirmed = window.confirm(
      `Delete "${bill.title}" permanently?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(bill.id);
    setError("");

    try {
      await historyApi.delete(bill.id);

      setBills((current) =>
        current.filter((item) => item.id !== bill.id)
      );
    } catch (err) {
      setError(
        err.message || "Unable to delete bill."
      );
    } finally {
      setDeleting(null);
    }
  }

  // ==========================================
  // SEARCH, FILTER AND SORT
  // ==========================================

  const filteredBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const results = bills.filter((bill) => {
      const title = String(
        bill.title || ""
      ).toLowerCase();

      const friendNames = Array.isArray(
        bill.friendNames
      )
        ? bill.friendNames
        : [];

      const matchesTitle = title.includes(query);

      const matchesFriend = friendNames.some((name) =>
        String(name).toLowerCase().includes(query)
      );

      const matchesSearch =
        matchesTitle || matchesFriend;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "settled" && bill.isSettled) ||
        (statusFilter === "pending" && !bill.isSettled);

      return matchesSearch && matchesStatus;
    });

    results.sort((a, b) => {
      if (sortOrder === "amount-high") {
        return (
          Number(b.grandTotal) -
          Number(a.grandTotal)
        );
      }

      if (sortOrder === "amount-low") {
        return (
          Number(a.grandTotal) -
          Number(b.grandTotal)
        );
      }

      const aDate = new Date(
        a.createdAt || 0
      ).getTime();

      const bDate = new Date(
        b.createdAt || 0
      ).getTime();

      return sortOrder === "oldest"
        ? aDate - bDate
        : bDate - aDate;
    });

    return results;
  }, [bills, searchQuery, statusFilter, sortOrder]);

  // ==========================================
  // STATISTICS
  // ==========================================

  const totalSpent = bills.reduce(
    (sum, bill) =>
      sum + (Number(bill.grandTotal) || 0),
    0
  );

  const settledCount = bills.filter(
    (bill) => bill.isSettled
  ).length;

  const pendingCount = bills.length - settledCount;

  // ==========================================
  // CLEAR FILTERS
  // ==========================================

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setSortOrder("newest");
  }

  // ==========================================
  // OFFLINE STATUS
  // ==========================================

  const isOffline =
    typeof navigator !== "undefined" &&
    !navigator.onLine;

  const showLoadFailure =
    loadError && bills.length === 0;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="split-page history-page neo-history-page">

      {/* ======================================
          HERO
      ====================================== */}

      <div className="page-heading neo-history-hero">
        <span className="section-label">
          SPLITMATE / YOUR ARCHIVE
        </span>

        <h1>
          Your Bill History
          <span className="neo-history-exclamation">
            !
          </span>
        </h1>

        <p>
          Every split. Every friend. Every payment.
          All in one place.
        </p>

        <div className="neo-history-hero-icon">
          <ReceiptText size={28} />
        </div>
      </div>

      {/* ======================================
          STATISTICS
      ====================================== */}

      {!loading && !showLoadFailure && (
        <div className="history-stats neo-history-stats">

          <div className="history-stat neo-stat-purple">
            <span>
              <ReceiptText size={18} />
              TOTAL BILLS
            </span>

            <strong>{bills.length}</strong>
          </div>

          <div className="history-stat neo-stat-yellow">
            <span>
              <Wallet size={18} />
              TOTAL SPENT
            </span>

            <strong>{money(totalSpent)}</strong>
          </div>

          <div className="history-stat neo-stat-green">
            <span>
              <CheckCircle2 size={18} />
              SETTLED
            </span>

            <strong>{settledCount}</strong>
          </div>

          <div className="history-stat neo-stat-pink">
            <span>
              <Clock3 size={18} />
              PENDING
            </span>

            <strong>{pendingCount}</strong>
          </div>

        </div>
      )}

      {/* ======================================
          SAVED BILLS PANEL
      ====================================== */}

      <section className="panel neo-history-main">

        {/* SECTION HEADING */}

        <div className="history-heading-row">
          <h2 className="panel-title">
            <History size={22} />
            Saved Bills
          </h2>

          <button
            type="button"
            className="small-button neo-history-refresh"
            onClick={loadBills}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading ? "history-spin" : ""
              }
            />

            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* ======================================
            ERROR MESSAGE
        ====================================== */}

        {error && (
          <div
            className="validation-message"
            role="alert"
          >
            {loadError && isOffline && (
              <WifiOff
                size={22}
                style={{
                  marginBottom: "8px",
                }}
              />
            )}

            <p>{error}</p>

            {loadError && (
              <button
                type="button"
                className="small-button"
                onClick={loadBills}
                disabled={loading}
                style={{
                  marginTop: "12px",
                }}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            )}
          </div>
        )}

        {/* ======================================
            LOADING STATE
        ====================================== */}

        {loading ? (
          <div className="history-loading">
            <RefreshCw
              size={25}
              className="history-spin"
            />

            <p>Loading your saved bills...</p>
          </div>
        ) : showLoadFailure ? (
          <div className="history-empty neo-history-empty">

            {isOffline ? (
              <WifiOff size={38} />
            ) : (
              <RefreshCw size={38} />
            )}

            <h3>
              {isOffline
                ? "You're offline!"
                : "Unable to load bills"}
            </h3>

            <p>
              {isOffline
                ? "Connect to the internet to access your saved bills."
                : "Please check your connection and try again."}
            </p>

            <button
              type="button"
              className="small-button"
              onClick={loadBills}
            >
              <RefreshCw size={17} />
              Try Again
            </button>

          </div>
        ) : (
          <>

            {/* ==================================
                SEARCH AND FILTERS
            ================================== */}

            {bills.length > 0 && (
              <div className="history-filter-panel neo-history-filters">

                <div className="history-filter-heading">
                  <h3>
                    <SlidersHorizontal size={19} />
                    FIND YOUR BILLS
                  </h3>

                  <span>
                    {filteredBills.length} of{" "}
                    {bills.length} bills
                  </span>
                </div>

                {/* SEARCH */}

                <div className="history-search-box">
                  <Search size={20} />

                  <input
                    type="search"
                    placeholder="Search bills or friends..."
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    aria-label="Search saved bills by title or friend"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      className="history-search-clear"
                      onClick={() =>
                        setSearchQuery("")
                      }
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* STATUS FILTERS */}

                <div
                  className="history-filter-tabs"
                  role="group"
                  aria-label="Filter bills by status"
                >
                  <button
                    type="button"
                    className={
                      statusFilter === "all"
                        ? "active"
                        : ""
                    }
                    aria-pressed={
                      statusFilter === "all"
                    }
                    onClick={() =>
                      setStatusFilter("all")
                    }
                  >
                    All Bills
                    <span>{bills.length}</span>
                  </button>

                  <button
                    type="button"
                    className={
                      statusFilter === "pending"
                        ? "active"
                        : ""
                    }
                    aria-pressed={
                      statusFilter === "pending"
                    }
                    onClick={() =>
                      setStatusFilter("pending")
                    }
                  >
                    <Clock3 size={15} />
                    Pending
                    <span>{pendingCount}</span>
                  </button>

                  <button
                    type="button"
                    className={
                      statusFilter === "settled"
                        ? "active"
                        : ""
                    }
                    aria-pressed={
                      statusFilter === "settled"
                    }
                    onClick={() =>
                      setStatusFilter("settled")
                    }
                  >
                    <CheckCircle2 size={15} />
                    Settled
                    <span>{settledCount}</span>
                  </button>
                </div>

                {/* SORT */}

                <div className="history-sort-row">
                  <label htmlFor="history-sort">
                    Sort by
                  </label>

                  <select
                    id="history-sort"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value)
                    }
                  >
                    <option value="newest">
                      Newest First
                    </option>

                    <option value="oldest">
                      Oldest First
                    </option>

                    <option value="amount-high">
                      Highest Amount
                    </option>

                    <option value="amount-low">
                      Lowest Amount
                    </option>
                  </select>

                  {(searchQuery ||
                    statusFilter !== "all" ||
                    sortOrder !== "newest") && (
                    <button
                      type="button"
                      className="history-clear-filters"
                      onClick={clearFilters}
                    >
                      <X size={16} />
                      Clear Filters
                    </button>
                  )}
                </div>

              </div>
            )}

            {/* ==================================
                EMPTY HISTORY
            ================================== */}

            {bills.length === 0 ? (
              <div className="history-empty neo-history-empty">
                <ReceiptText size={38} />

                <h3>No saved bills yet!</h3>

                <p>
                  Your future restaurant adventures
                  will appear here.
                </p>

                <Link
                  to="/scan"
                  className="small-button"
                >
                  Scan Your First Bill
                  <ArrowRight size={17} />
                </Link>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="history-empty neo-history-empty">
                <Search size={38} />

                <h3>No matching bills</h3>

                <p>
                  Try another search or change
                  your filters.
                </p>

                <button
                  type="button"
                  className="small-button"
                  onClick={clearFilters}
                >
                  <X size={17} />
                  Clear Filters
                </button>
              </div>
            ) : (

              /* ==================================
                  BILL CARDS
              ================================== */

              <div className="history-list neo-history-list">

                {filteredBills.map((bill, index) => (
                  <article
                    className={`history-bill neo-history-bill ${
                      bill.isSettled
                        ? "neo-bill-settled"
                        : "neo-bill-pending"
                    }`}
                    key={bill.id}
                  >

                    <div className="history-bill-icon">
                      {index % 3 === 0 ? (
                        <ReceiptText size={24} />
                      ) : index % 3 === 1 ? (
                        <Wallet size={24} />
                      ) : (
                        <Sparkles size={24} />
                      )}
                    </div>

                    <div className="history-bill-content">
                      <h3>{bill.title}</h3>

                      <span className="neo-history-meta">
                        {formatDate(bill.createdAt)}
                        {" · "}
                        <Users
                          size={13}
                          style={{
                            verticalAlign: "middle",
                          }}
                        />
                        {" "}
                        {bill.friendCount} friends
                      </span>

                      <span
                        className={`history-status ${
                          bill.isSettled
                            ? "settled"
                            : "pending"
                        }`}
                      >
                        {bill.isSettled ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Clock3 size={15} />
                        )}

                        {bill.isSettled
                          ? "Settled"
                          : "Pending"}
                      </span>
                    </div>

                    <div className="history-bill-actions">
                      <strong>
                        {money(bill.grandTotal)}
                      </strong>

                      <div className="history-action-buttons">
                        <Link
                          className="small-button"
                          to={`/history/${bill.id}`}
                        >
                          View Bill
                          <ArrowRight size={16} />
                        </Link>

                        <button
                          type="button"
                          className="history-delete"
                          disabled={
                            deleting === bill.id
                          }
                          onClick={() =>
                            deleteBill(bill)
                          }
                          aria-label={`Delete ${bill.title}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>

                  </article>
                ))}

              </div>
            )}

          </>
        )}

      </section>
    </div>
  );
}
