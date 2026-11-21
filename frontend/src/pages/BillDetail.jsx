
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ReceiptText,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Users,
  CalendarDays,
} from "lucide-react";

import { historyApi } from "../api/history";
import SavedReceipt from "./SavedReceipt";

// Format integer paise as Indian rupees
function money(paise) {
  const value = Number(paise) || 0;

  return `₹${(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BillDetail() {
  const { id } = useParams();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Rename bill
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Load bill from Django
  useEffect(() => {
    let active = true;

    async function loadBill() {
      setLoading(true);
      setError("");
      setBill(null);
      setEditingTitle(false);

      try {
        const result = await historyApi.get(id);

        if (active) {
          setBill(result);
          setNewTitle(result.title);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Failed to load bill."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBill();

    return () => {
      active = false;
    };
  }, [id]);

  // Rename a saved bill
  async function renameBill() {
    if (!bill || saving) return;

    const title = newTitle.trim();

    if (!title || title.length > 120) {
      setError(
        "Enter a valid bill title (maximum 120 characters)."
      );
      return;
    }

    if (title === bill.title) {
      setEditingTitle(false);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updated = await historyApi.rename(
        bill.id,
        title
      );

      setBill(updated);
      setNewTitle(updated.title);
      setEditingTitle(false);
    } catch (err) {
      setError(
        err.message || "Could not rename bill."
      );
    } finally {
      setSaving(false);
    }
  }

  // Update Paid/Pending status in Django
  async function togglePaid(index) {
    if (!bill || saving) return;

    const transfer = bill.transfers[index];

    if (!transfer) return;

    setSaving(true);
    setError("");

    try {
      const updated = await historyApi.updatePayment(
        bill.id,
        index,
        !transfer.paid
      );

      setBill(updated);
    } catch (err) {
      setError(
        err.message || "Could not update payment."
      );
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="split-page history-page">
        <section className="panel">
          <h2 className="panel-title">
            <ReceiptText size={22} />
            Loading Saved Bill
          </h2>

          <p>Please wait...</p>
        </section>
      </div>
    );
  }

  // Bill unavailable
  if (!bill) {
    return (
      <div className="split-page history-page">
        <section className="panel">
          <h2 className="panel-title">
            <AlertTriangle size={22} />
            Bill Unavailable
          </h2>

          <p>
            {error || "Bill not found."}
          </p>

          <Link
            to="/history"
            className="small-button"
          >
            <ArrowLeft size={17} />
            Back to History
          </Link>
        </section>
      </div>
    );
  }

  // Friend ID -> name mapping
  const names = Object.fromEntries(
    bill.friends.map((friend) => [
      friend.id,
      friend.name,
    ])
  );

  // Settlement calculations
  const totalTransfers = bill.transfers.reduce(
    (sum, transfer) => sum + transfer.amount,
    0
  );

  const received = bill.transfers.reduce(
    (sum, transfer) =>
      sum +
      (transfer.paid ? transfer.amount : 0),
    0
  );

  const pending = totalTransfers - received;

  const paidCount = bill.transfers.filter(
    (transfer) => transfer.paid
  ).length;

  const progress =
    totalTransfers === 0
      ? 100
      : (received / totalTransfers) * 100;

  const isSettled = bill.transfers.every(
    (transfer) => transfer.paid
  );

  return (
    <div className="split-page history-page">

      {/* PAGE HEADING */}
      <div className="page-heading">
        <span className="section-label">
          SPLITMATE BILL HISTORY
        </span>

        {!editingTitle ? (
          <div className="history-title-row">
            <h1>{bill.title}</h1>

            <button
              type="button"
              className="history-icon-button"
              disabled={saving}
              onClick={() => {
                setNewTitle(bill.title);
                setEditingTitle(true);
                setError("");
              }}
              aria-label="Rename bill"
            >
              <Pencil size={19} />
            </button>
          </div>
        ) : (
          <form
            className="history-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              renameBill();
            }}
          >
            <input
              type="text"
              value={newTitle}
              maxLength={120}
              autoFocus
              onChange={(event) =>
                setNewTitle(event.target.value)
              }
              aria-label="Bill name"
            />

            <button
              type="submit"
              className="small-button"
              disabled={
                saving || !newTitle.trim()
              }
            >
              <Save size={17} />
              Save
            </button>

            <button
              type="button"
              className="history-icon-button"
              disabled={saving}
              onClick={() => {
                setEditingTitle(false);
                setNewTitle(bill.title);
                setError("");
              }}
              aria-label="Cancel renaming"
            >
              <X size={19} />
            </button>
          </form>
        )}

        <p className="history-date">
          <CalendarDays size={16} />

          Saved on{" "}
          {new Date(
            bill.createdAt
          ).toLocaleString("en-IN")}
        </p>
      </div>

      {/* TOP ACTIONS */}
      <div className="history-top-actions">
        <Link
          to="/history"
          className="small-button"
        >
          <ArrowLeft size={17} />
          Back to History
        </Link>

        <span
          className={`history-status-badge ${
            isSettled
              ? "settled"
              : "pending"
          }`}
        >
          {isSettled ? (
            <CheckCircle2 size={16} />
          ) : (
            <Clock3 size={16} />
          )}

          {isSettled
            ? "Settled"
            : "Pending"}
        </span>
      </div>

      {error && (
        <p
          className="validation-message"
          role="alert"
        >
          <AlertTriangle size={17} />
          {error}
        </p>
      )}

      {/* MAIN LAYOUT */}
      <div className="split-layout">

        <div className="split-main">

          {/* BILL DETAILS */}
          <section className="panel">

            <h2 className="panel-title">
              <ReceiptText size={22} />
              Bill Details
            </h2>

            <div className="summary-total">
              <span>Restaurant bill</span>

              <strong>
                {money(bill.grandTotal)}
              </strong>

              <small>
                <Users size={14} />
                {" "}
                {bill.friends.length} friends
              </small>
            </div>

            {/* INDIVIDUAL SHARES */}
            <h3>Individual Shares</h3>

            <div className="history-detail-list">
              {bill.friends.map((friend) => (
                <div
                  className="history-detail-row"
                  key={friend.id}
                >
                  <span>
                    {friend.name}
                  </span>

                  <strong>
                    {money(friend.share)}
                  </strong>
                </div>
              ))}
            </div>

            {/* RESTAURANT PAYMENTS */}
            <h3>Restaurant Payments</h3>

            <div className="history-detail-list">
              {bill.friends.map((friend) => (
                <div
                  className="history-detail-row"
                  key={friend.id}
                >
                  <span>
                    {friend.name}
                  </span>

                  <strong>
                    {money(
                      bill.payments[friend.id] ?? 0
                    )}
                  </strong>
                </div>
              ))}
            </div>

          </section>

          {/* ORIGINAL RECEIPT */}
          <SavedReceipt
            receiptData={bill.receiptData}
            grandTotal={bill.grandTotal}
            friends={bill.friends}
          />

        </div>

        {/* PAYMENT TRACKING */}
        <aside className="panel summary-panel">

          <h2 className="panel-title">
            <ArrowRight size={22} />
            Payment Tracking
          </h2>

          {bill.transfers.length === 0 ? (
            <p className="review-match">
              <CheckCircle2 size={18} />
              No transfers required.
            </p>
          ) : (
            <div className="summary-list">
              {bill.transfers.map(
                (transfer, index) => (
                  <div
                    className="settlement-transfer settlement-tracked-transfer"
                    key={index}
                  >

                    <div className="settlement-transfer-info">
                      <div className="settlement-transfer-route">

                        <strong>
                          {names[transfer.fromId] ||
                            "Unknown"}
                        </strong>

                        <ArrowRight size={18} />

                        <strong>
                          {names[transfer.toId] ||
                            "Unknown"}
                        </strong>
                      </div>

                      <strong className="settlement-amount">
                        {money(transfer.amount)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      className={`settlement-status-button ${
                        transfer.paid
                          ? "is-paid"
                          : "is-pending"
                      }`}
                      onClick={() =>
                        togglePaid(index)
                      }
                    >
                      {transfer.paid ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Clock3 size={16} />
                      )}

                      {transfer.paid
                        ? "Paid"
                        : "Pending"}
                    </button>

                  </div>
                )
              )}
            </div>
          )}

          {/* PAYMENT PROGRESS */}
          <div className="settlement-tracking">

            <div className="settlement-tracking-heading">
              <h3>Payment Progress</h3>

              <span>
                {paidCount} of{" "}
                {bill.transfers.length} paid
              </span>
            </div>

            <div
              className="settlement-progress-track"
              role="progressbar"
              aria-label="Payment progress"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="settlement-progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="settlement-tracking-totals">

              <div className="settlement-tracking-card">
                <span>Received</span>

                <strong className="settlement-received">
                  {money(received)}
                </strong>
              </div>

              <div className="settlement-tracking-card">
                <span>Pending</span>

                <strong>
                  {money(pending)}
                </strong>
              </div>

            </div>

            {bill.transfers.length > 0 &&
              paidCount === bill.transfers.length && (
                <p className="review-match">
                  <CheckCircle2 size={18} />
                  All payments are marked
                  as received!
                </p>
              )}

          </div>

        </aside>

      </div>

    </div>
  );
}
