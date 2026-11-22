
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BillProgress from "../components/BillProgress";

import {
  Wallet,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Copy,
  RefreshCw,
  Clock3,
  Save,
  QrCode,
} from "lucide-react";

import { historyApi } from "../api/history";
import UPIQRCode from "../components/UPIQRCode";

const STORAGE_KEY = "splitmate_settlement";
const TRACKING_KEY = "splitmate_payment_tracking";

const STATUSES = ["pending", "awaiting", "confirmed"];

function toPaise(value) {
  const text = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [rupees, decimal = ""] = text.split(".");

  const amount =
    Number(rupees) * 100 +
    Number(decimal.padEnd(2, "0"));

  return Number.isSafeInteger(amount) && amount >= 0
    ? amount
    : null;
}

function money(paise) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function loadSettlement() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const data = JSON.parse(raw);

    if (
      !Array.isArray(data.friends) ||
      data.friends.length === 0 ||
      !Number.isSafeInteger(data.grandTotal) ||
      data.grandTotal < 0
    ) {
      return null;
    }

    const ids = new Set();
    let totalShares = 0;

    for (const friend of data.friends) {
      if (
        typeof friend.id !== "string" ||
        !friend.id ||
        ids.has(friend.id) ||
        typeof friend.name !== "string" ||
        !friend.name.trim() ||
        !Number.isSafeInteger(friend.share) ||
        friend.share < 0
      ) {
        return null;
      }

      ids.add(friend.id);
      totalShares += friend.share;

      if (!Number.isSafeInteger(totalShares)) {
        return null;
      }
    }

    if (totalShares !== data.grandTotal) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function calculateTransfers(friends, payments) {
  const creditors = [];
  const debtors = [];

  for (const friend of friends) {
    const paid = toPaise(payments[friend.id]);

    if (paid === null) return [];

    const balance = paid - friend.share;

    if (balance > 0) {
      creditors.push({
        id: friend.id,
        name: friend.name,
        remaining: balance,
      });
    } else if (balance < 0) {
      debtors.push({
        id: friend.id,
        name: friend.name,
        remaining: -balance,
      });
    }
  }

  const transfers = [];
  let i = 0;
  let j = 0;

  while (
    i < debtors.length &&
    j < creditors.length
  ) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(
      debtor.remaining,
      creditor.remaining
    );

    if (amount > 0) {
      transfers.push({
        fromId: debtor.id,
        toId: creditor.id,
        from: debtor.name,
        to: creditor.name,
        amount,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) i++;
    if (creditor.remaining === 0) j++;
  }

  return transfers;
}

function createPayments(data) {
  return Object.fromEntries(
    (data?.friends ?? []).map((friend) => [
      friend.id,
      "0.00",
    ])
  );
}

function settlementSignature(data) {
  if (!data) return "";

  return JSON.stringify({
    grandTotal: data.grandTotal,
    friends: data.friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      share: friend.share,
    })),
  });
}

function transferKey(transfer) {
  return JSON.stringify([
    transfer.fromId,
    transfer.toId,
    transfer.amount,
  ]);
}

function transferSignature(transfers) {
  return JSON.stringify(transfers.map(transferKey));
}

function loadTracking(data) {
  const initial = {
    signature: settlementSignature(data),
    payments: createPayments(data),
    transferSignature: "",
    statuses: {},
    upiIds: {},
  };

  if (!data) return initial;

  try {
    const raw = sessionStorage.getItem(TRACKING_KEY);

    if (!raw) return initial;

    const saved = JSON.parse(raw);

    if (
      saved.signature !== initial.signature ||
      !saved.payments ||
      typeof saved.payments !== "object" ||
      !saved.statuses ||
      typeof saved.statuses !== "object"
    ) {
      return initial;
    }

    const payments = {};

    for (const friend of data.friends) {
      const value = saved.payments[friend.id];

      if (
        typeof value !== "string" ||
        toPaise(value) === null
      ) {
        return initial;
      }

      payments[friend.id] = value;
    }

    const totalPaid = Object.values(payments).reduce(
      (sum, value) => sum + toPaise(value),
      0
    );

    const transfers =
      totalPaid === data.grandTotal
        ? calculateTransfers(data.friends, payments)
        : [];

    const signature = transferSignature(transfers);
    const upiIds = {};

    for (const friend of data.friends) {
      const value = saved.upiIds?.[friend.id];

      upiIds[friend.id] =
        typeof value === "string" ? value : "";
    }

    return {
      signature: initial.signature,
      payments,
      upiIds,
      transferSignature: signature,
      statuses:
        saved.transferSignature === signature
          ? Object.fromEntries(
              transfers.map((transfer) => {
                const key = transferKey(transfer);
                const value = saved.statuses[key];

                return [
                  key,
                  value === true
                    ? "confirmed"
                    : STATUSES.includes(value)
                      ? value
                      : "pending",
                ];
              })
            )
          : {},
    };
  } catch {
    return initial;
  }
}

export default function Settlement() {
  const navigate = useNavigate();

  const [data, setData] = useState(loadSettlement);

  const [tracking, setTracking] = useState(
    () => loadTracking(loadSettlement())
  );

  const [message, setMessage] = useState("");

  const [billTitle, setBillTitle] = useState(
    "Dinner with Friends"
  );

  const [savingBill, setSavingBill] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [expandedQRs, setExpandedQRs] = useState({});

  const payments = tracking.payments;
  const upiIds = tracking.upiIds ?? {};

  const paymentAmounts = data
    ? data.friends.map((friend) =>
        toPaise(payments[friend.id])
      )
    : [];

  const validPayments = paymentAmounts.every(
    (amount) => amount !== null
  );

  const totalPaid = validPayments
    ? paymentAmounts.reduce(
        (sum, amount) => sum + amount,
        0
      )
    : 0;

  const paymentMatches =
    data !== null &&
    validPayments &&
    totalPaid === data.grandTotal;

  const transfers = paymentMatches
    ? calculateTransfers(data.friends, payments)
    : [];

  const currentTransferSignature =
    transferSignature(transfers);

  const statuses =
    tracking.transferSignature ===
    currentTransferSignature
      ? tracking.statuses
      : {};

  function getStatus(transfer) {
    const value = statuses[transferKey(transfer)];

    return value === true
      ? "confirmed"
      : STATUSES.includes(value)
        ? value
        : "pending";
  }

  function isPaid(transfer) {
    return getStatus(transfer) === "confirmed";
  }

  const awaitingCount = transfers.filter(
    (transfer) =>
      getStatus(transfer) === "awaiting"
  ).length;

  const totalToSettle = transfers.reduce(
    (sum, transfer) => sum + transfer.amount,
    0
  );

  const totalReceived = transfers.reduce(
    (sum, transfer) =>
      sum +
      (isPaid(transfer) ? transfer.amount : 0),
    0
  );

  const totalPending =
    totalToSettle - totalReceived;

  const paidCount = transfers.filter(isPaid).length;

  const progress =
    totalToSettle > 0
      ? (totalReceived / totalToSettle) * 100
      : paymentMatches
        ? 100
        : 0;

  // Save payment tracking in session storage.
  useEffect(() => {
    if (!data) return;

    try {
      sessionStorage.setItem(
        TRACKING_KEY,
        JSON.stringify(tracking)
      );
    } catch {
      // Storage may be unavailable.
    }
  }, [data, tracking]);

  function reload() {
    const latest = loadSettlement();

    setData(latest);
    setTracking(loadTracking(latest));
    setExpandedQRs({});
    setMessage("");
    setSaveError("");
  }

  function updatePayment(id, value) {
    setTracking((current) => ({
      ...current,
      payments: {
        ...current.payments,
        [id]: value,
      },
      transferSignature: "",
      statuses: {},
    }));

    setExpandedQRs({});
    setMessage("");
    setSaveError("");
  }

  function updateUpiId(friendId, value) {
    setTracking((current) => ({
      ...current,
      upiIds: {
        ...current.upiIds,
        [friendId]: value,
      },
    }));

    setSaveError("");
  }

  function toggleQRCode(transfer) {
    const key = transferKey(transfer);

    setExpandedQRs((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  // Pending -> Awaiting -> Confirmed.
  function setTransferStatus(transfer, nextStatus) {
    if (!STATUSES.includes(nextStatus)) {
      return;
    }

    const currentStatus = getStatus(transfer);

    const allowedNext = {
      pending: ["pending", "awaiting"],
      awaiting: [
        "awaiting",
        "confirmed",
        "pending",
      ],
      confirmed: ["confirmed", "pending"],
    };

    if (
      !allowedNext[currentStatus].includes(
        nextStatus
      )
    ) {
      return;
    }

    const key = transferKey(transfer);

    setTracking((current) => {
      const previous =
        current.transferSignature ===
        currentTransferSignature
          ? current.statuses
          : {};

      return {
        ...current,
        transferSignature:
          currentTransferSignature,
        statuses: {
          ...previous,
          [key]: nextStatus,
        },
      };
    });

    setMessage("");
    setSaveError("");
  }

  // Save the settlement to Django history.
  async function saveBillToHistory() {
    if (
      !paymentMatches ||
      !data ||
      savingBill
    ) {
      return;
    }

    const title = billTitle.trim();

    if (!title) {
      setSaveError("Please enter a bill title.");
      return;
    }

    if (title.length > 120) {
      setSaveError(
        "Bill title must be 120 characters or fewer."
      );
      return;
    }

    setSavingBill(true);
    setSaveError("");

    try {
      const paymentValues = {};

      for (const friend of data.friends) {
        const amount = toPaise(
          payments[friend.id]
        );

        if (amount === null) {
          throw new Error(
            "Invalid restaurant payment."
          );
        }

        paymentValues[friend.id] = amount;
      }

      const cleanedUpiIds = {};

      const upiPattern =
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;

      for (const friend of data.friends) {
        const upiId = (
          upiIds[friend.id] ?? ""
        ).trim();

        if (
          upiId &&
          !upiPattern.test(upiId)
        ) {
          throw new Error(
            `Invalid UPI ID for ${friend.name}.`
          );
        }

        if (upiId) {
          cleanedUpiIds[friend.id] = upiId;
        }
      }

      const payload = {
        title,
        grandTotal: data.grandTotal,

        friends: data.friends.map((friend) => ({
          id: friend.id,
          name: friend.name,
          share: friend.share,
        })),

        payments: paymentValues,

        transfers: transfers.map((transfer) => ({
          fromId: transfer.fromId,
          toId: transfer.toId,
          amount: transfer.amount,
          paid: isPaid(transfer),
          status: getStatus(transfer),
        })),

        receiptData: data.receiptData ?? {},
        upiIds: cleanedUpiIds,
      };

      const saved = await historyApi.create(payload);

      navigate(`/history/${saved.id}`);
    } catch (error) {
      setSaveError(
        error.message ||
        "Unable to save bill."
      );
    } finally {
      setSavingBill(false);
    }
  }

  // Prepare the shareable settlement summary.
  const shareText = paymentMatches
    ? [
        "SplitMate — Payment Settlement",
        "",
        `Restaurant bill: ${money(
          data.grandTotal
        )}`,
        "",
        "Individual shares:",
        ...data.friends.map(
          (friend) =>
            `${friend.name}: ${money(
              friend.share
            )}`
        ),
        "",
        "Payments to settle:",
        ...(transfers.length
          ? transfers.map((transfer) => {
              const status = getStatus(transfer);

              const label =
                status === "confirmed"
                  ? "Confirmed Paid"
                  : status === "awaiting"
                    ? "Awaiting Confirmation"
                    : "Pending";

              return (
                `${transfer.from} pays ` +
                `${transfer.to} ` +
                `${money(transfer.amount)}` +
                ` — ${label}`
              );
            })
          : ["No transfers required."]),
        "",
        `Received: ${money(totalReceived)}`,
        `Pending: ${money(totalPending)}`,
        `Completed: ${paidCount}/${transfers.length}`,
      ].join("\n")
    : "";

  async function copySummary() {
    if (!shareText) return;

    try {
      await navigator.clipboard.writeText(
        shareText
      );

      setMessage(
        "Settlement summary copied."
      );
    } catch {
      setMessage(
        "Could not copy automatically."
      );
    }
  }

  async function shareSummary() {
    if (!shareText) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "SplitMate Settlement",
          text: shareText,
        });

        return;
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
      }
    }

    await copySummary();
  }

  return (
    <div className="split-page settlement-page">

      {/* PAGE HEADING */}
      <div className="page-heading">
        <span className="section-label">
          SPLITMATE SETTLEMENT
        </span>

        <h1>Settle up, effortlessly.</h1>

        <p>
          Enter who paid the restaurant,
          calculate settlements, generate
          UPI payment QR codes, track payments,
          and save the bill to your history.
        </p>
      </div>

      {/* NEO-BRUTALIST WORKFLOW PROGRESS */}
      <BillProgress currentStep="settle" />

      {!data ? (
        <section className="panel">
          <h2 className="panel-title">
            <AlertTriangle size={22} />
            No completed split found
          </h2>

          <p>
            Complete the food assignments
            on the Split Bill page first.
          </p>

          <Link
            to="/split"
            className="small-button"
          >
            Go to Split Bill
            <ArrowRight size={17} />
          </Link>
        </section>
      ) : (
        <div className="split-layout">

          {/* RESTAURANT PAYMENT */}
          <div className="split-main">
            <section className="panel">
              <h2 className="panel-title">
                <Wallet size={22} />
                Restaurant Payment
              </h2>

              <div className="summary-total">
                <span>
                  Total restaurant bill
                </span>

                <strong>
                  {money(data.grandTotal)}
                </strong>

                <small>
                  {data.friends.length} friends
                </small>
              </div>

              <p>
                Enter the amount each friend
                actually paid to the restaurant.
                Enter zero for anyone who did
                not pay.
              </p>

              {/* FRIEND PAYMENTS */}
              <div className="settlement-payment-list">
                {data.friends.map(
                  (friend, index) => (
                    <div
                      className="settlement-payment-row"
                      key={friend.id}
                    >
                      <div className="summary-person-name">
                        <span
                          className={`avatar avatar-${
                            index % 5
                          }`}
                        >
                          {friend.name[0].toUpperCase()}
                        </span>

                        <div>
                          <strong>
                            {friend.name}
                          </strong>

                          <small>
                            Owes{" "}
                            {money(friend.share)}
                          </small>
                        </div>
                      </div>

                      <label>
                        <span>Paid (₹)</span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            payments[friend.id] ??
                            "0.00"
                          }
                          onChange={(event) =>
                            updatePayment(
                              friend.id,
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  )
                )}
              </div>

              {/* PAYMENT TOTAL */}
              <div className="summary-total">
                <span>
                  Total payment entered
                </span>

                <strong>
                  {validPayments
                    ? money(totalPaid)
                    : "Invalid amount"}
                </strong>
              </div>

              {!paymentMatches ? (
                <p className="validation-message">
                  <AlertTriangle size={17} />

                  {!validPayments
                    ? "Enter valid payment amounts."
                    : `Payments must add up to ${money(
                        data.grandTotal
                      )}.`}
                </p>
              ) : (
                <p className="review-match">
                  <CheckCircle2 size={18} />
                  Payments match the
                  restaurant bill.
                </p>
              )}
            </section>
          </div>

          {/* SETTLEMENT SUMMARY */}
          <aside className="panel summary-panel">
            <h2 className="panel-title">
              <Users size={22} />
              Who Pays Whom?
            </h2>

            {!paymentMatches ? (
              <p className="validation-message">
                Enter all restaurant payments
                correctly to calculate settlements.
              </p>
            ) : (
              <>
                {/* TRANSFER LIST */}
                <div className="summary-list">
                  {transfers.length === 0 ? (
                    <p className="review-match">
                      <CheckCircle2 size={18} />
                      No transfers needed.
                      Everyone has covered
                      their share.
                    </p>
                  ) : (
                    transfers.map((transfer) => {
                      const status = getStatus(
                        transfer
                      );

                      const confirmed =
                        status === "confirmed";

                      const key = transferKey(
                        transfer
                      );

                      return (
                        <div
                          className="settlement-transfer settlement-tracked-transfer"
                          key={key}
                        >
                          {/* TRANSFER DETAILS */}
                          <div className="settlement-transfer-info">
                            <div className="settlement-transfer-route">
                              <strong>
                                {transfer.from}
                              </strong>

                              <ArrowRight size={18} />

                              <strong>
                                {transfer.to}
                              </strong>
                            </div>

                            <strong className="settlement-amount">
                              {money(
                                transfer.amount
                              )}
                            </strong>
                          </div>

                          {/* UPI QR GENERATION */}
                          <div
                            style={{
                              marginTop: 12,
                              marginBottom: 12,
                            }}
                          >
                            <button
                              type="button"
                              className="small-button"
                              onClick={() =>
                                toggleQRCode(
                                  transfer
                                )
                              }
                              aria-expanded={
                                !!expandedQRs[key]
                              }
                            >
                              <QrCode size={17} />

                              {expandedQRs[key]
                                ? "Hide UPI QR"
                                : "Generate UPI QR"}
                            </button>

                            {expandedQRs[key] && (
                              <UPIQRCode
                                recipientName={
                                  transfer.to
                                }
                                amount={
                                  transfer.amount
                                }
                                upiId={
                                  upiIds[
                                    transfer.toId
                                  ] || ""
                                }
                                onUpiIdChange={(
                                  value
                                ) =>
                                  updateUpiId(
                                    transfer.toId,
                                    value
                                  )
                                }
                              />
                            )}
                          </div>

                          {/* PAYMENT STATUS */}
                          <span
                            className={`settlement-status-button ${
                              confirmed
                                ? "is-paid"
                                : "is-pending"
                            }`}
                          >
                            {confirmed ? (
                              <CheckCircle2
                                size={16}
                              />
                            ) : (
                              <Clock3 size={16} />
                            )}

                            {status === "confirmed"
                              ? "Confirmed Paid"
                              : status === "awaiting"
                                ? "Awaiting Confirmation"
                                : "Pending"}
                          </span>

                          {/* PAYMENT ACTIONS */}
                          <div
                            className="settlement-actions"
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 10,
                            }}
                          >
                            {status === "pending" && (
                              <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                  setTransferStatus(
                                    transfer,
                                    "awaiting"
                                  )
                                }
                              >
                                I've Paid
                              </button>
                            )}

                            {status === "awaiting" && (
                              <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                  setTransferStatus(
                                    transfer,
                                    "confirmed"
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={16}
                                />
                                Confirm Received
                              </button>
                            )}

                            {status !== "pending" && (
                              <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                  setTransferStatus(
                                    transfer,
                                    "pending"
                                  )
                                }
                              >
                                Reset to Pending
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* PAYMENT PROGRESS */}
                <div className="settlement-tracking">
                  <div className="settlement-tracking-heading">
                    <h3>Payment Progress</h3>

                    <span>
                      {paidCount} confirmed ·{" "}
                      {awaitingCount} awaiting ·{" "}
                      {transfers.length} total
                    </span>
                  </div>

                  <div
                    className="settlement-progress-track"
                    role="progressbar"
                    aria-label="Payment progress"
                    aria-valuenow={Math.round(
                      progress
                    )}
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
                        {money(totalReceived)}
                      </strong>
                    </div>

                    <div className="settlement-tracking-card">
                      <span>Pending</span>

                      <strong>
                        {money(totalPending)}
                      </strong>
                    </div>
                  </div>

                  {transfers.length > 0 &&
                    paidCount ===
                      transfers.length && (
                      <p className="review-match">
                        <CheckCircle2
                          size={18}
                        />
                        All payments are
                        confirmed received!
                      </p>
                    )}
                </div>

                {/* SAVE TO HISTORY */}
                <div className="history-save-panel">
                  <h3>Save to Bill History</h3>

                  <p>
                    Save this settlement and
                    its UPI recipient details
                    to Django so you can
                    reopen it later.
                  </p>

                  <label htmlFor="splitmate-bill-title">
                    Bill name
                  </label>

                  <input
                    id="splitmate-bill-title"
                    type="text"
                    maxLength={120}
                    placeholder="e.g. Saturday Dinner"
                    value={billTitle}
                    onChange={(event) => {
                      setBillTitle(
                        event.target.value
                      );

                      setSaveError("");
                    }}
                  />

                  <button
                    type="button"
                    className="small-button"
                    disabled={savingBill}
                    onClick={saveBillToHistory}
                  >
                    <Save size={18} />

                    {savingBill
                      ? "Saving..."
                      : "Save Bill to History"}
                  </button>

                  {saveError && (
                    <p className="validation-message">
                      <AlertTriangle size={17} />
                      {saveError}
                    </p>
                  )}
                </div>

                {/* COPY AND SHARE */}
                <div className="settlement-actions">
                  <button
                    type="button"
                    className="small-button"
                    onClick={copySummary}
                  >
                    <Copy size={17} />
                    Copy Summary
                  </button>

                  <button
                    type="button"
                    className="small-button"
                    onClick={shareSummary}
                  >
                    <Share2 size={17} />
                    Share
                  </button>
                </div>

                {message && (
                  <p className="review-match">
                    {message}
                  </p>
                )}
              </>
            )}

            {/* SETTLEMENT NOTE */}
            <div className="summary-note">
              <CheckCircle2 size={18} />

              <span>
                Settlement amounts use exact
                paise values. UPI QR codes
                request payment but do not
                verify it. Payment confirmation
                is manual.
              </span>
            </div>

            <button
              type="button"
              className="small-button"
              onClick={reload}
            >
              <RefreshCw size={17} />
              Reload Split
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
