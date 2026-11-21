
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
} from "lucide-react";

import { historyApi } from "../api/history";


// =============================================
// CURRENCY FORMATTER
// =============================================

function money(paise) {
  const value = Number(paise) || 0;

  return `₹${(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}


// =============================================
// DATE FORMATTER
// =============================================

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


// =============================================
// MAIN COMPONENT
// =============================================

export default function BillHistory() {
  const [bills, setBills] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  // Phase 4.1 controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");


  // =============================================
  // FETCH SAVED BILLS
  // =============================================

  async function loadBills() {
    setLoading(true);
    setError("");

    try {
      const result = await historyApi.list();

      setBills(
        Array.isArray(result.bills)
          ? result.bills
          : []
      );
    } catch (err) {
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


  // =============================================
  // DELETE SAVED BILL
  // =============================================

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
        current.filter(
          (item) => item.id !== bill.id
        )
      );
    } catch (err) {
      setError(
        err.message || "Unable to delete bill."
      );
    } finally {
      setDeleting(null);
    }
  }


  // =============================================
  // FILTER AND SORT BILLS
  // =============================================

  const filteredBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const results = bills.filter((bill) => {
      const title = String(
        bill.title || ""
      ).toLowerCase();

      // The existing list API returns a title
      // and friendCount, but not friend names.
      // Search therefore matches bill titles.
      const matchesSearch =
        title.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "settled" && bill.isSettled) ||
        (statusFilter === "pending" && !bill.isSettled);

      return matchesSearch && matchesStatus;
    });

    results.sort((a, b) => {
      if (sortOrder === "amount-high") {
        return b.grandTotal - a.grandTotal;
      }

      if (sortOrder === "amount-low") {
        return a.grandTotal - b.grandTotal;
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


  // =============================================
  // BILL STATISTICS
  // =============================================

  const totalSpent = bills.reduce(
    (sum, bill) =>
      sum + (Number(bill.grandTotal) || 0),
    0
  );

  const settledCount = bills.filter(
    (bill) => bill.isSettled
  ).length;

  const pendingCount = bills.length - settledCount;


  // =============================================
  // CLEAR FILTERS
  // =============================================

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setSortOrder("newest");
  }


  return (
    <div className="split-page history-page">

      {/* =========================================
          PAGE HEADING
      ========================================= */}

      <div className="page-heading">
        <span className="section-label">
          SPLITMATE HISTORY
        </span>

        <h1>Your bill history.</h1>

        <p>
          Revisit restaurant bills, find past
          expenses, and continue tracking payments.
        </p>
      </div>


      <section className="panel">

        {/* HEADER */}

        <div className="history-heading-row">
          <h2 className="panel-title">
            <History size={22} />
            Saved Bills
          </h2>

          <button
            type="button"
            className="small-button"
            onClick={loadBills}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? "history-spin" : ""}
            />

            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>


        {/* ERROR */}

        {error && (
          <p
            className="validation-message"
            role="alert"
          >
            {error}
          </p>
        )}


        {/* LOADING */}

        {loading ? (
          <div className="history-loading">
            <RefreshCw
              size={25}
              className="history-spin"
            />

            <p>Loading your saved bills...</p>
          </div>
        ) : (
          <>

            {/* =====================================
                STATISTICS
            ===================================== */}

            <div className="history-stats">

              <div className="history-stat">
                <span>
                  <ReceiptText size={16} />
                  Total Bills
                </span>

                <strong>
                  {bills.length}
                </strong>
              </div>


              <div className="history-stat">
                <span>
                  <Wallet size={16} />
                  Total Spent
                </span>

                <strong>
                  {money(totalSpent)}
                </strong>
              </div>


              <div className="history-stat">
                <span>
                  <CheckCircle2 size={16} />
                  Settled Bills
                </span>

                <strong>
                  {settledCount}
                </strong>
              </div>


              <div className="history-stat">
                <span>
                  <Clock3 size={16} />
                  Pending Bills
                </span>

                <strong>
                  {pendingCount}
                </strong>
              </div>

            </div>


            {/* =====================================
                SEARCH AND FILTERS
            ===================================== */}

            {bills.length > 0 && (
              <div className="history-filter-panel">

                <div className="history-filter-heading">
                  <h3>
                    <SlidersHorizontal size={19} />
                    Find Your Bills
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
                    placeholder="Search by bill name..."
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    aria-label="Search saved bills"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      className="history-search-clear"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>


                {/* STATUS FILTER */}

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
                    aria-pressed={statusFilter === "all"}
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
                    aria-pressed={statusFilter === "pending"}
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
                    aria-pressed={statusFilter === "settled"}
                    onClick={() =>
                      setStatusFilter("settled")
                    }
                  >
                    <CheckCircle2 size={15} />
                    Settled
                    <span>{settledCount}</span>
                  </button>
                </div>


                {/* SORTING */}

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


            {/* =====================================
                EMPTY HISTORY
            ===================================== */}

            {bills.length === 0 ? (
              <div className="history-empty">
                <ReceiptText size={35} />

                <h3>No saved bills yet</h3>

                <p>
                  Complete a settlement and save
                  it to see it here.
                </p>

                <Link
                  to="/scan"
                  className="small-button"
                >
                  Scan a Bill
                  <ArrowRight size={17} />
                </Link>
              </div>
            ) : filteredBills.length === 0 ? (

              /* NO FILTER RESULTS */

              <div className="history-empty">
                <Search size={35} />

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

              /* ===================================
                  BILL CARDS
              =================================== */

              <div className="history-list">

                {filteredBills.map((bill) => (
                  <article
                    className="history-bill"
                    key={bill.id}
                  >

                    {/* ICON */}

                    <div className="history-bill-icon">
                      <ReceiptText size={22} />
                    </div>


                    {/* BILL INFORMATION */}

                    <div className="history-bill-content">
                      <h3>{bill.title}</h3>

                      <span>
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


                    {/* BILL ACTIONS */}

                    <div className="history-bill-actions">
                      <strong>
                        {money(bill.grandTotal)}
                      </strong>

                      <div className="history-action-buttons">
                        <Link
                          className="small-button"
                          to={`/history/${bill.id}`}
                        >
                          View
                          <ArrowRight size={16} />
                        </Link>

                        <button
                          type="button"
                          className="history-delete"
                          disabled={deleting === bill.id}
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
