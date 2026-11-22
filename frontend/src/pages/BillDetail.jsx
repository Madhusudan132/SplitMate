
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
  RotateCcw,
  Hourglass,
  QrCode,
  Wallet,
} from "lucide-react";

import { historyApi } from "../api/history";
import UPIQRCode from "../components/UPIQRCode";
import SavedReceipt from "./SavedReceipt";

const UPI_PATTERN =
  /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;

function money(paise) {
  const value = Number(paise) || 0;

  return `₹${(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPaymentStatus(transfer) {
  if (
    ["pending", "awaiting", "confirmed"].includes(
      transfer?.status
    )
  ) {
    return transfer.status;
  }

  return transfer?.paid === true
    ? "confirmed"
    : "pending";
}

function getStatusLabel(status) {
  if (status === "confirmed") {
    return "Confirmed Paid";
  }

  if (status === "awaiting") {
    return "Awaiting Confirmation";
  }

  return "Pending";
}

export default function BillDetail() {
  const { id } = useParams();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingTitle, setEditingTitle] =
    useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [upiIds, setUpiIds] = useState({});
  const [upiDirty, setUpiDirty] = useState(false);
  const [expandedQRs, setExpandedQRs] = useState({});

  useEffect(() => {
    let active = true;

    async function loadBill() {
      setLoading(true);
      setError("");
      setMessage("");
      setBill(null);
      setEditingTitle(false);
      setExpandedQRs({});
      setUpiDirty(false);

      try {
        const result = await historyApi.get(id);

        if (!active) return;

        setBill(result);
        setNewTitle(result.title);
        setUpiIds(result.upiIds ?? {});
      } catch (err) {
        if (active) {
          setError(
            err.message || "Failed to load bill."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBill();

    return () => {
      active = false;
    };
  }, [id]);

  function updateUpiId(friendId, value) {
    setUpiIds((current) => ({
      ...current,
      [friendId]: value,
    }));

    setUpiDirty(true);
    setError("");
    setMessage("");
  }

  function toggleQRCode(index) {
    setExpandedQRs((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }

  async function saveUpiIds() {
    if (!bill || saving) return;

    const cleaned = {};

    for (const friend of bill.friends) {
      const value = String(
        upiIds[friend.id] ?? ""
      ).trim();

      if (!value) continue;

      if (
        value.length > 120 ||
        !UPI_PATTERN.test(value)
      ) {
        setError(
          `Enter a valid UPI ID for ${friend.name}.`
        );
        return;
      }

      cleaned[friend.id] = value;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated =
        await historyApi.updateUpiIds(
          bill.id,
          cleaned
        );

      setBill(updated);
      setUpiIds(updated.upiIds ?? {});
      setUpiDirty(false);

      setMessage(
        "Recipient UPI IDs saved successfully."
      );
    } catch (err) {
      setError(
        err.message || "Could not save UPI IDs."
      );
    } finally {
      setSaving(false);
    }
  }

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
    setMessage("");

    try {
      const updated = await historyApi.rename(
        bill.id,
        title
      );

      setBill(updated);
      setNewTitle(updated.title);
      setEditingTitle(false);

      setMessage(
        "Bill name updated successfully."
      );
    } catch (err) {
      setError(
        err.message || "Could not rename bill."
      );
    } finally {
      setSaving(false);
    }
  }

  function namesForMessage(friendId) {
    const friend = bill?.friends?.find(
      (item) => item.id === friendId
    );

    return friend?.name || "The payer";
  }

  async function updatePaymentStatus(
    index,
    nextStatus
  ) {
    if (!bill || saving) return;

    if (
      !["pending", "awaiting", "confirmed"].includes(
        nextStatus
      )
    ) {
      return;
    }

    const transfer = bill.transfers[index];

    if (!transfer) return;

    const currentStatus =
      getPaymentStatus(transfer);

    if (currentStatus === nextStatus) {
      return;
    }

    const allowedNext = {
      pending: ["awaiting"],
      awaiting: ["confirmed", "pending"],
      confirmed: ["pending"],
    };

    if (
      !allowedNext[currentStatus].includes(
        nextStatus
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated =
        await historyApi.updatePayment(
          bill.id,
          index,
          nextStatus
        );

      setBill(updated);

      if (nextStatus === "awaiting") {
        setMessage(
          `${namesForMessage(
            transfer.fromId
          )} reported making the payment. Awaiting recipient confirmation.`
        );
      } else if (nextStatus === "confirmed") {
        setMessage(
          "Payment receipt recorded as confirmed."
        );
      } else {
        setMessage(
          "Payment status reset to Pending."
        );
      }
    } catch (err) {
      setError(
        err.message || "Could not update payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="split-page history-page neo-detail-page">
        <section className="panel neo-detail-overview">
          <h2 className="panel-title">
            <ReceiptText size={22} />
            Loading Saved Bill
          </h2>
          <p>Please wait...</p>
        </section>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="split-page history-page neo-detail-page">
        <section className="panel neo-detail-overview">
          <h2 className="panel-title">
            <AlertTriangle size={22} />
            Bill Unavailable
          </h2>

          <p>{error || "Bill not found."}</p>

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

  const names = Object.fromEntries(
    bill.friends.map((friend) => [
      friend.id,
      friend.name,
    ])
  );

  const totalTransfers = bill.transfers.reduce(
    (sum, transfer) => sum + transfer.amount,
    0
  );

  const received = bill.transfers.reduce(
    (sum, transfer) =>
      sum +
      (getPaymentStatus(transfer) === "confirmed"
        ? transfer.amount
        : 0),
    0
  );

  const pending = totalTransfers - received;

  const paidCount = bill.transfers.filter(
    (transfer) =>
      getPaymentStatus(transfer) === "confirmed"
  ).length;

  const awaitingCount = bill.transfers.filter(
    (transfer) =>
      getPaymentStatus(transfer) === "awaiting"
  ).length;

  const progress =
    totalTransfers === 0
      ? 100
      : (received / totalTransfers) * 100;

  const isSettled = bill.transfers.every(
    (transfer) =>
      getPaymentStatus(transfer) === "confirmed"
  );

  return (
    <div className="split-page history-page neo-detail-page">

      {/* PAGE HEADING */}
      <div className="page-heading neo-detail-hero">
        <span className="section-label">
          SPLITMATE / SAVED BILL
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
                setMessage("");
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
                setMessage("");
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
      <div className="history-top-actions neo-detail-top-actions">
        <Link
          to="/history"
          className="small-button"
        >
          <ArrowLeft size={17} />
          Back to History
        </Link>

        <span
          className={`history-status-badge ${
            isSettled ? "settled" : "pending"
          }`}
        >
          {isSettled ? (
            <CheckCircle2 size={16} />
          ) : (
            <Clock3 size={16} />
          )}

          {isSettled ? "Settled" : "Pending"}
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

      {message && (
        <p className="review-match">
          <CheckCircle2 size={17} />
          {message}
        </p>
      )}

      {/* MAIN LAYOUT */}
      <div className="split-layout">
        <div className="split-main">

          {/* BILL OVERVIEW */}
          <section className="panel neo-detail-overview">
            <h2 className="panel-title">
              <ReceiptText size={22} />
              Bill Overview
            </h2>

            <div className="summary-total neo-detail-total">
              <span>RESTAURANT BILL</span>

              <strong>
                {money(bill.grandTotal)}
              </strong>

              <small>
                <Users size={14} />{" "}
                {bill.friends.length} friends
              </small>
            </div>

            {/* INDIVIDUAL SHARES */}
            <h3 className="neo-detail-section-title">
              <Users size={19} />
              Individual Shares
            </h3>

            <div className="history-detail-list neo-detail-friends">
              {bill.friends.map((friend, index) => (
                <div
                  className="history-detail-row neo-detail-friend"
                  key={friend.id}
                >
                  <div className="neo-detail-friend-name">
                    <span
                      className={`avatar avatar-${index % 5}`}
                    >
                      {friend.name[0].toUpperCase()}
                    </span>

                    <span>{friend.name}</span>
                  </div>

                  <strong>
                    {money(friend.share)}
                  </strong>
                </div>
              ))}
            </div>

            {/* RESTAURANT PAYMENTS */}
            <h3 className="neo-detail-section-title">
              <Wallet size={19} />
              Restaurant Payments
            </h3>

            <div className="history-detail-list neo-detail-payments">
              {bill.friends.map((friend) => (
                <div
                  className="history-detail-row"
                  key={friend.id}
                >
                  <span>{friend.name}</span>

                  <strong>
                    {money(
                      bill.payments[friend.id] ?? 0
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          {/* ORIGINAL SAVED RECEIPT */}
          <div className="neo-detail-receipt">
            <SavedReceipt
              receiptData={bill.receiptData}
              grandTotal={bill.grandTotal}
              friends={bill.friends}
            />
          </div>
        </div>

        {/* PAYMENT TRACKING */}
        <aside className="panel summary-panel neo-detail-tracking">
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
                (transfer, index) => {
                  const status =
                    getPaymentStatus(transfer);

                  const confirmed =
                    status === "confirmed";

                  const recipientName =
                    names[transfer.toId] || "Unknown";

                  return (
                    <div
                      className="settlement-transfer settlement-tracked-transfer neo-detail-transfer"
                      key={`${transfer.fromId}-${transfer.toId}-${index}`}
                    >
                      {/* TRANSFER DETAILS */}
                      <div className="settlement-transfer-info">
                        <div className="settlement-transfer-route">
                          <strong>
                            {names[transfer.fromId] ||
                              "Unknown"}
                          </strong>

                          <ArrowRight size={18} />

                          <strong>
                            {recipientName}
                          </strong>
                        </div>

                        <strong className="settlement-amount">
                          {money(transfer.amount)}
                        </strong>
                      </div>

                      {/* UPI QR */}
                      <div className="neo-detail-qr-section">
                        <button
                          type="button"
                          className="small-button neo-detail-qr-button"
                          aria-expanded={
                            !!expandedQRs[index]
                          }
                          onClick={() =>
                            toggleQRCode(index)
                          }
                        >
                          <QrCode size={17} />

                          {expandedQRs[index]
                            ? "Hide UPI QR"
                            : "Generate UPI QR"}
                        </button>

                        {expandedQRs[index] && (
                          <div className="neo-detail-qr-content">
                            <UPIQRCode
                              recipientName={
                                recipientName
                              }
                              amount={transfer.amount}
                              upiId={
                                upiIds[
                                  transfer.toId
                                ] || ""
                              }
                              onUpiIdChange={(value) =>
                                updateUpiId(
                                  transfer.toId,
                                  value
                                )
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* PAYMENT STATUS */}
                      <span
                        className={`settlement-status-button ${
                          confirmed
                            ? "is-paid"
                            : "is-pending"
                        }`}
                        role="status"
                      >
                        {confirmed ? (
                          <CheckCircle2 size={16} />
                        ) : status === "awaiting" ? (
                          <Hourglass size={16} />
                        ) : (
                          <Clock3 size={16} />
                        )}

                        {getStatusLabel(status)}
                      </span>

                      {/* PAYMENT ACTIONS */}
                      <div className="settlement-actions neo-detail-actions">
                        {status === "pending" && (
                          <button
                            type="button"
                            className="small-button"
                            disabled={saving}
                            onClick={() =>
                              updatePaymentStatus(
                                index,
                                "awaiting"
                              )
                            }
                          >
                            <Clock3 size={16} />
                            I've Paid
                          </button>
                        )}

                        {status === "awaiting" && (
                          <button
                            type="button"
                            className="small-button"
                            disabled={saving}
                            onClick={() =>
                              updatePaymentStatus(
                                index,
                                "confirmed"
                              )
                            }
                          >
                            <CheckCircle2 size={16} />
                            Confirm Received
                          </button>
                        )}

                        {status !== "pending" && (
                          <button
                            type="button"
                            className="small-button"
                            disabled={saving}
                            onClick={() =>
                              updatePaymentStatus(
                                index,
                                "pending"
                              )
                            }
                          >
                            <RotateCcw size={16} />
                            Reset to Pending
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {/* SAVE UPI DETAILS */}
          {bill.transfers.length > 0 && (
            <div className="history-save-panel neo-detail-upi-save">
              <h3>Recipient UPI Details</h3>

              <p>
                Enter or edit the UPI ID inside
                each payment QR section, then
                save the changes.
              </p>

              <button
                type="button"
                className="small-button"
                disabled={saving || !upiDirty}
                onClick={saveUpiIds}
              >
                <Save size={17} />
                {saving
                  ? "Saving..."
                  : "Save UPI Details"}
              </button>

              {upiDirty && (
                <p className="validation-message">
                  <AlertTriangle size={16} />
                  You have unsaved UPI changes.
                </p>
              )}
            </div>
          )}

          {/* PAYMENT PROGRESS */}
          <div className="settlement-tracking neo-detail-progress">
            <div className="settlement-tracking-heading">
              <h3>Payment Progress</h3>

              <span>
                {paidCount} confirmed ·{" "}
                {awaitingCount} awaiting ·{" "}
                {bill.transfers.length} total
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

                <strong>{money(pending)}</strong>
              </div>
            </div>

            {bill.transfers.length > 0 &&
              paidCount === bill.transfers.length && (
                <p className="review-match">
                  <CheckCircle2 size={18} />
                  All payments are confirmed received!
                </p>
              )}

            <p className="summary-note neo-detail-payment-note">
              UPI QR codes only request payments.
              They do not verify transactions.
              Confirm Received should be used
              only after checking the recipient's
              payment account.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
