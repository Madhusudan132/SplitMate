
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ReceiptText,
  AlertTriangle,
} from "lucide-react";

import { historyApi } from "../api/history";

function money(paise) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await historyApi.get(id);

        if (active) setBill(result);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  async function togglePaid(index) {
    if (!bill || saving) return;

    setSaving(true);
    setError("");

    try {
      const result =
        await historyApi.updatePayment(
          bill.id,
          index,
          !bill.transfers[index].paid
        );

      setBill(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="split-page">
        <section className="panel">
          Loading saved bill...
        </section>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="split-page">
        <section className="panel">
          <h2 className="panel-title">
            <AlertTriangle size={22} />
            Bill unavailable
          </h2>

          <p>
            {error || "Bill not found."}
          </p>

          <Link
            to="/history"
            className="small-button"
          >
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

  const totalTransfers =
    bill.transfers.reduce(
      (sum, transfer) =>
        sum + transfer.amount,
      0
    );

  const received = bill.transfers.reduce(
    (sum, transfer) =>
      sum +
      (transfer.paid
        ? transfer.amount
        : 0),
    0
  );

  const paidCount = bill.transfers.filter(
    (transfer) => transfer.paid
  ).length;

  const progress =
    totalTransfers === 0
      ? 100
      : (received / totalTransfers) * 100;

  return (
    <div className="split-page history-page">
      <div className="page-heading">
        <span className="section-label">
          SAVED BILL
        </span>

        <h1>{bill.title}</h1>

        <p>
          Saved on{" "}
          {new Date(
            bill.createdAt
          ).toLocaleString("en-IN")}
        </p>
      </div>

      <Link
        to="/history"
        className="small-button"
      >
        <ArrowLeft size={17} />
        Back to History
      </Link>

      <div className="split-layout">
        <div className="split-main">
          <section className="panel">
            <h2 className="panel-title">
              <ReceiptText size={22} />
              Bill Details
            </h2>

            <div className="summary-total">
              <span>
                Restaurant bill
              </span>

              <strong>
                {money(bill.grandTotal)}
              </strong>

              <small>
                {bill.friends.length} friends
              </small>
            </div>

            <h3>Individual Shares</h3>

            <div className="history-detail-list">
              {bill.friends.map(
                (friend) => (
                  <div
                    className="history-detail-row"
                    key={friend.id}
                  >
                    <span>{friend.name}</span>

                    <strong>
                      {money(friend.share)}
                    </strong>
                  </div>
                )
              )}
            </div>

            <h3>Restaurant Payments</h3>

            <div className="history-detail-list">
              {bill.friends.map(
                (friend) => (
                  <div
                    className="history-detail-row"
                    key={friend.id}
                  >
                    <span>{friend.name}</span>

                    <strong>
                      {money(
                        bill.payments[
                          friend.id
                        ] ?? 0
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          </section>
        </div>

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
                          {names[
                            transfer.fromId
                          ]}
                        </strong>

                        <ArrowRight
                          size={18}
                        />

                        <strong>
                          {names[
                            transfer.toId
                          ]}
                        </strong>
                      </div>

                      <strong className="settlement-amount">
                        {money(
                          transfer.amount
                        )}
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
                        <CheckCircle2
                          size={16}
                        />
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

          <div className="settlement-tracking">
            <div className="settlement-tracking-heading">
              <h3>Payment Progress</h3>

              <span>
                {paidCount} of{" "}
                {bill.transfers.length} paid
              </span>
            </div>

            <div className="settlement-progress-track">
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
                  {money(
                    totalTransfers -
                      received
                  )}
                </strong>
              </div>
            </div>
          </div>

          {error && (
            <p className="validation-message">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
