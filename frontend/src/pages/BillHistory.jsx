
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  History,
  ReceiptText,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { historyApi } from "../api/history";

function money(paise) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BillHistory() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  async function loadBills() {
    setLoading(true);
    setError("");

    try {
      const result = await historyApi.list();
      setBills(result.bills);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
  }, []);

  async function deleteBill(bill) {
    if (
      !window.confirm(
        `Delete "${bill.title}" permanently?`
      )
    ) {
      return;
    }

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
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const totalSpent = bills.reduce(
    (sum, bill) => sum + bill.grandTotal,
    0
  );

  const settledCount = bills.filter(
    (bill) => bill.isSettled
  ).length;

  return (
    <div className="split-page history-page">
      <div className="page-heading">
        <span className="section-label">
          SPLITMATE HISTORY
        </span>

        <h1>Your bill history.</h1>

        <p>
          Revisit restaurant bills and
          continue tracking payments.
        </p>
      </div>

      <section className="panel">
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
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        {error && (
          <p className="validation-message">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading your saved bills...</p>
        ) : (
          <>
            <div className="history-stats">
              <div className="history-stat">
                <span>Total bills</span>
                <strong>{bills.length}</strong>
              </div>

              <div className="history-stat">
                <span>Total spent</span>
                <strong>
                  {money(totalSpent)}
                </strong>
              </div>

              <div className="history-stat">
                <span>Settled bills</span>
                <strong>{settledCount}</strong>
              </div>
            </div>

            {bills.length === 0 ? (
              <div className="history-empty">
                <ReceiptText size={35} />

                <h3>No saved bills yet</h3>

                <p>
                  Complete a settlement and
                  save it to see it here.
                </p>

                <Link
                  to="/scan"
                  className="small-button"
                >
                  Scan a Bill
                  <ArrowRight size={17} />
                </Link>
              </div>
            ) : (
              <div className="history-list">
                {bills.map((bill) => (
                  <article
                    className="history-bill"
                    key={bill.id}
                  >
                    <div className="history-bill-icon">
                      <ReceiptText size={22} />
                    </div>

                    <div className="history-bill-content">
                      <h3>{bill.title}</h3>

                      <span>
                        {new Date(
                          bill.createdAt
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                        {" · "}
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
                          <CheckCircle2
                            size={15}
                          />
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
                        {money(
                          bill.grandTotal
                        )}
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
