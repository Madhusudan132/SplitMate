
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Users,
  Plus,
  ReceiptText,
  Droplets,
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  ArrowRight,
} from "lucide-react";

const RECEIPT_STORAGE_KEY = "splitmate_reviewed_receipt";
const SETTLEMENT_STORAGE_KEY = "splitmate_settlement";

// Generate unique IDs
const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

// Convert rupees into integer paise
function toPaise(value, allowNegative = false) {
  const text = String(value ?? "").trim();

  const pattern = allowNegative
    ? /^-?\d+(?:\.\d{1,2})?$/
    : /^\d+(?:\.\d{1,2})?$/;

  if (!pattern.test(text)) return null;

  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;

  const [rupees, decimals = ""] = unsigned.split(".");

  const result =
    Number(rupees) * 100 +
    Number(decimals.padEnd(2, "0"));

  if (!Number.isSafeInteger(result)) return null;

  return negative ? -result : result;
}

// Format integer paise as Indian rupees
function formatMoney(paise) {
  if (
    paise === null ||
    !Number.isFinite(paise)
  ) {
    return "—";
  }

  const sign = paise < 0 ? "-" : "";

  return `${sign}₹${(
    Math.abs(paise) / 100
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Divide amount equally, including remaining paise
function distributeEqually(amount, ids) {
  const result = Object.fromEntries(
    ids.map((id) => [id, 0])
  );

  if (ids.length === 0) return result;

  const base = Math.floor(amount / ids.length);
  const remainder = amount - base * ids.length;

  ids.forEach((id, index) => {
    result[id] =
      base + (index < remainder ? 1 : 0);
  });

  return result;
}

// Divide food price by assigned quantities
function distributeWeighted(amount, weights, ids) {
  const result = Object.fromEntries(
    ids.map((id) => [id, 0])
  );

  const totalWeight = ids.reduce(
    (sum, id) => sum + (weights[id] ?? 0),
    0
  );

  if (totalWeight <= 0) {
    return result;
  }

  const sign = amount < 0 ? -1 : 1;
  const absolute = Math.abs(amount);

  const entries = ids.map((id, index) => {
    const numerator =
      absolute * (weights[id] ?? 0);

    const base = Math.floor(
      numerator / totalWeight
    );

    return {
      id,
      index,
      base,
      fraction: numerator % totalWeight,
    };
  });

  let remainder =
    absolute -
    entries.reduce(
      (sum, entry) => sum + entry.base,
      0
    );

  const ranked = [...entries].sort(
    (a, b) =>
      b.fraction - a.fraction ||
      a.index - b.index
  );

  for (const entry of ranked) {
    if (remainder <= 0) break;

    entry.base += 1;
    remainder -= 1;
  }

  entries.forEach((entry) => {
    result[entry.id] =
      sign * entry.base;
  });

  return result;
}

// Read confirmed receipt from Scan Bill
function readReceipt() {
  try {
    const raw = sessionStorage.getItem(
      RECEIPT_STORAGE_KEY
    );

    if (!raw) return null;

    const receipt = JSON.parse(raw);

    if (
      !Array.isArray(receipt.items) ||
      receipt.items.length === 0 ||
      !receipt.summary
    ) {
      return null;
    }

    const subtotal = toPaise(
      receipt.summary.subtotal ??
        receipt.subtotal
    );

    const grandTotal = toPaise(
      receipt.summary.total ??
        receipt.grand_total
    );

    if (
      subtotal === null ||
      grandTotal === null
    ) {
      return null;
    }

    const items = receipt.items.map((item) => ({
      id: makeId(),
      name: String(item.name ?? ""),
      quantity: Number(item.quantity),
      price: String(item.total_price ?? ""),
      type: "common",
      selected: [],
      allocations: {},
    }));

    if (
      items.some(
        (item) =>
          !item.name.trim() ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          toPaise(item.price) === null
      )
    ) {
      return null;
    }

    const itemTotal = items.reduce(
      (sum, item) =>
        sum + toPaise(item.price),
      0
    );

    if (itemTotal !== subtotal) {
      return null;
    }

    const summary = receipt.summary;

    const cgst = toPaise(
      summary.cgst ?? "0"
    );

    const sgst = toPaise(
      summary.sgst ?? "0"
    );

    const igst = toPaise(
      summary.igst ?? "0"
    );

    const service = toPaise(
      summary.service_charge ?? "0"
    );

    const discount = toPaise(
      summary.discount ?? "0"
    );

    const roundOff = toPaise(
      summary.round_off ?? "0",
      true
    );

    if (
      [
        cgst,
        sgst,
        igst,
        service,
        discount,
        roundOff,
      ].some((value) => value === null)
    ) {
      return null;
    }

    const totalTax =
      cgst + sgst + igst;

    const adjustments =
      totalTax +
      service -
      discount +
      roundOff;

    if (
      subtotal + adjustments !== grandTotal
    ) {
      return null;
    }

    return {
      items,
      subtotal,
      grandTotal,
      totalTax,
      adjustments,
      summary,
    };
  } catch {
    return null;
  }
}

export default function SplitBill() {
  const navigate = useNavigate();

  const [receipt, setReceipt] = useState(
    readReceipt
  );

  const [friends, setFriends] = useState([]);

  const [items, setItems] = useState(
    () => receipt?.items ?? []
  );

  const [friendName, setFriendName] =
    useState("");

  const [error, setError] = useState("");

  // Reload confirmed receipt
  function reloadReceipt() {
    const latest = readReceipt();

    setReceipt(latest);
    setItems(latest?.items ?? []);
    setFriends([]);
    setFriendName("");

    sessionStorage.removeItem(
      SETTLEMENT_STORAGE_KEY
    );

    setError(
      latest
        ? ""
        : "No valid confirmed receipt found. Scan and confirm a receipt first."
    );
  }

  // Add friend
  function addFriend() {
    const name = friendName.trim();

    if (!name) {
      setError("Enter a friend's name.");
      return;
    }

    if (
      friends.some(
        (friend) =>
          friend.name.toLowerCase() ===
          name.toLowerCase()
      )
    ) {
      setError(
        "This friend has already been added."
      );
      return;
    }

    setFriends((current) => [
      ...current,
      {
        id: makeId(),
        name,
      },
    ]);

    setFriendName("");
    setError("");
  }

  // Remove friend and assignments
  function removeFriend(id) {
    setFriends((current) =>
      current.filter(
        (friend) => friend.id !== id
      )
    );

    setItems((current) =>
      current.map((item) => {
        const allocations = {
          ...item.allocations,
        };

        delete allocations[id];

        return {
          ...item,
          selected: item.selected.filter(
            (friendId) => friendId !== id
          ),
          allocations,
        };
      })
    );
  }

  // Update item
  function updateItem(id, changes) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...changes }
          : item
      )
    );
  }

  // Change splitting method
  function changeType(item, type) {
    updateItem(item.id, {
      type,
      selected: [],
      allocations: {},
    });
  }

  // Select friends for individual/shared dishes
  function toggleFriend(item, id) {
    const selected =
      item.type === "individual"
        ? [id]
        : item.selected.includes(id)
          ? item.selected.filter(
              (value) => value !== id
            )
          : [...item.selected, id];

    updateItem(item.id, {
      selected,
    });
  }

  // Assign food quantities
  function changeQuantity(
    item,
    friendId,
    value
  ) {
    const quantity = Number(value);

    if (
      !/^\d+$/.test(String(value)) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0
    ) {
      return;
    }

    updateItem(item.id, {
      allocations: {
        ...item.allocations,
        [friendId]: quantity,
      },
    });
  }

  // Validate assignments
  function itemIsValid(item) {
    if (
      toPaise(item.price) === null
    ) {
      return false;
    }

    if (item.type === "common") {
      return friends.length > 0;
    }

    if (item.type === "individual") {
      return (
        item.selected.length === 1 &&
        friends.some(
          (friend) =>
            friend.id === item.selected[0]
        )
      );
    }

    if (item.type === "shared") {
      return (
        item.selected.length > 0 &&
        item.selected.every((id) =>
          friends.some(
            (friend) => friend.id === id
          )
        )
      );
    }

    if (item.type === "quantity") {
      const quantities = friends.map(
        (friend) =>
          item.allocations[friend.id] ?? 0
      );

      return (
        quantities.every(
          (value) =>
            Number.isSafeInteger(value) &&
            value >= 0
        ) &&
        quantities.reduce(
          (sum, value) => sum + value,
          0
        ) === item.quantity
      );
    }

    return false;
  }

  // Verify receipt item totals
  const currentSubtotal = items.reduce(
    (sum, item) =>
      sum + (toPaise(item.price) ?? 0),
    0
  );

  const receiptMatches =
    receipt !== null &&
    currentSubtotal === receipt.subtotal &&
    items.length === receipt.items.length &&
    items.every(
      (item, index) =>
        item.name ===
          receipt.items[index].name &&
        item.quantity ===
          receipt.items[index].quantity &&
        item.price ===
          receipt.items[index].price
    );

  const valid =
    receiptMatches &&
    friends.length > 0 &&
    items.length > 0 &&
    items.every(itemIsValid);

  const friendIds = friends.map(
    (friend) => friend.id
  );

  // Initialize food shares
  const foodShares = Object.fromEntries(
    friendIds.map((id) => [id, 0])
  );

  // Calculate each friend's food cost
  if (valid) {
    for (const item of items) {
      const amount = toPaise(
        item.price
      );

      let shares = {};

      if (item.type === "common") {
        shares = distributeEqually(
          amount,
          friendIds
        );
      } else if (
        item.type === "individual"
      ) {
        shares = {
          [item.selected[0]]: amount,
        };
      } else if (
        item.type === "shared"
      ) {
        shares = distributeEqually(
          amount,
          item.selected
        );
      } else if (
        item.type === "quantity"
      ) {
        shares = distributeWeighted(
          amount,
          item.allocations,
          friendIds
        );
      }

      for (const [
        id,
        share,
      ] of Object.entries(shares)) {
        foodShares[id] += share;
      }
    }
  }

  // Taxes are divided equally among ALL friends
  const taxShares = valid
    ? distributeEqually(
        receipt.totalTax,
        friendIds
      )
    : Object.fromEntries(
        friendIds.map((id) => [id, 0])
      );

  // Service charges, discounts and rounding
  // are also divided equally
  const otherAdjustments = receipt
    ? receipt.adjustments -
      receipt.totalTax
    : 0;

  const otherShares = valid
    ? distributeEqually(
        otherAdjustments,
        friendIds
      )
    : Object.fromEntries(
        friendIds.map((id) => [id, 0])
      );

  // Final amount for each friend
  const balances = Object.fromEntries(
    friendIds.map((id) => [
      id,
      foodShares[id] +
        taxShares[id] +
        otherShares[id],
    ])
  );

  const distributedTotal =
    Object.values(balances).reduce(
      (sum, value) => sum + value,
      0
    );

  const totalsMatch =
    valid &&
    distributedTotal ===
      receipt.grandTotal;

  // Save completed split and open Settlement
  function continueToSettlement() {
    if (!totalsMatch || !receipt) {
      setError(
        "Complete the bill split before continuing."
      );
      return;
    }

    const settlementData = {
      grandTotal: receipt.grandTotal,
      friends: friends.map((friend) => ({
        id: String(friend.id),
        name: friend.name,
        share: balances[friend.id],
      })),
    };

    sessionStorage.setItem(
      SETTLEMENT_STORAGE_KEY,
      JSON.stringify(settlementData)
    );

    navigate("/settlement");
  }

  return (
    <div className="split-page">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <span className="section-label">
          SPLITMATE CALCULATOR
        </span>

        <h1>
          Split your bill fairly.
        </h1>

        <p>
          Add friends, assign food items,
          and calculate everyone's share
          including equal taxes.
        </p>
      </div>

      <div className="split-layout">
        <div className="split-main">
          {/* CONFIRMED RECEIPT */}
          <section className="panel">
            <h2 className="panel-title">
              <ReceiptText size={22} />
              Confirmed Receipt
            </h2>

            {receipt ? (
              <>
                <div className="summary-total">
                  <span>
                    Restaurant bill
                  </span>

                  <strong>
                    {formatMoney(
                      receipt.grandTotal
                    )}
                  </strong>

                  <small>
                    Food:{" "}
                    {formatMoney(
                      receipt.subtotal
                    )}
                    {" · "}
                    Tax:{" "}
                    {formatMoney(
                      receipt.totalTax
                    )}
                    {" · "}
                    Other:{" "}
                    {formatMoney(
                      otherAdjustments
                    )}
                  </small>
                </div>

                <p className="summary-note">
                  <CheckCircle2 size={18} />
                  Loaded from your
                  confirmed receipt.
                </p>
              </>
            ) : (
              <p className="validation-message">
                No confirmed receipt was found.
                Open Scan Bill, review the
                amounts, and confirm the
                receipt first.
              </p>
            )}

            <button
              type="button"
              className="small-button"
              onClick={reloadReceipt}
            >
              <RefreshCw size={17} />
              Reload Confirmed Receipt
            </button>
          </section>

          {/* FRIENDS */}
          <section className="panel">
            <h2 className="panel-title">
              <Users size={22} />
              Your Friends
            </h2>

            <div className="friend-list">
              {friends.map(
                (friend, index) => (
                  <div
                    className="friend-chip"
                    key={friend.id}
                  >
                    <span
                      className={`avatar avatar-${
                        index % 5
                      }`}
                    >
                      {friend.name[0].toUpperCase()}
                    </span>

                    <span>
                      {friend.name}
                    </span>

                    <button
                      type="button"
                      aria-label={`Remove ${friend.name}`}
                      onClick={() =>
                        removeFriend(friend.id)
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="add-row">
              <input
                placeholder="Enter friend's name"
                value={friendName}
                onChange={(event) =>
                  setFriendName(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    addFriend();
                  }
                }}
              />

              <button
                type="button"
                className="small-button"
                onClick={addFriend}
              >
                <Plus size={18} />
                Add Friend
              </button>
            </div>

            {error && (
              <p className="validation-message">
                {error}
              </p>
            )}
          </section>

          {/* RESTAURANT ITEMS */}
          <section className="panel">
            <h2 className="panel-title">
              <ReceiptText size={22} />
              Restaurant Items
            </h2>

            <div className="item-legend">
              <span className="legend-individual">
                Individual
              </span>

              <span className="legend-common">
                Common
              </span>

              <span className="legend-shared">
                Shared
              </span>
            </div>

            {items.map((item) => {
              const assignedQuantity =
                friendIds.reduce(
                  (sum, id) =>
                    sum +
                    (item.allocations[id] ?? 0),
                  0
                );

              return (
                <div
                  className={`bill-item item-${item.type}`}
                  key={item.id}
                >
                  <div className="item-heading">
                    <div className="item-name-row">
                      {item.name
                        .toLowerCase()
                        .includes("water") ? (
                        <Droplets size={19} />
                      ) : (
                        <UtensilsCrossed size={19} />
                      )}

                      <strong>
                        {item.name}
                      </strong>
                    </div>
                  </div>

                  <div className="item-controls">
                    <label>
                      Line total (₹)
                      <input
                        value={item.price}
                        readOnly
                      />
                    </label>

                    <label>
                      Quantity
                      <input
                        value={item.quantity}
                        readOnly
                      />
                    </label>

                    <label>
                      Split Type
                      <select
                        value={item.type}
                        onChange={(event) =>
                          changeType(
                            item,
                            event.target.value
                          )
                        }
                      >
                        <option value="individual">
                          Individual
                        </option>

                        <option value="shared">
                          Shared equally
                        </option>

                        <option value="common">
                          Common (everyone)
                        </option>

                        <option value="quantity">
                          By quantity
                        </option>
                      </select>
                    </label>
                  </div>

                  {item.type === "common" ? (
                    <div className="common-notice">
                      <CheckCircle2 size={17} />

                      <span>
                        Split equally among
                        all {friends.length} friends.
                      </span>
                    </div>
                  ) : item.type ===
                    "quantity" ? (
                    <div className="selection-area">
                      <p>
                        Assign all{" "}
                        {item.quantity} portions
                        to friends.
                      </p>

                      <div className="quantity-list">
                        {friends.map(
                          (friend) => (
                            <label
                              className="quantity-person"
                              key={friend.id}
                            >
                              <span>
                                {friend.name}
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  item.allocations[
                                    friend.id
                                  ] ?? 0
                                }
                                onChange={(
                                  event
                                ) =>
                                  changeQuantity(
                                    item,
                                    friend.id,
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          )
                        )}
                      </div>

                      <p
                        className={
                          assignedQuantity ===
                          item.quantity
                            ? "review-match"
                            : "review-mismatch"
                        }
                      >
                        Assigned{" "}
                        {assignedQuantity} of{" "}
                        {item.quantity} portions.
                      </p>
                    </div>
                  ) : (
                    <div className="selection-area">
                      <p>
                        {item.type ===
                        "individual"
                          ? "Who ordered this dish?"
                          : "Who shared this dish?"}
                      </p>

                      <div className="selection-list">
                        {friends.map(
                          (friend) => (
                            <label
                              className="person-option"
                              key={friend.id}
                            >
                              <input
                                type={
                                  item.type ===
                                  "individual"
                                    ? "radio"
                                    : "checkbox"
                                }
                                name={`item-${item.id}`}
                                checked={item.selected.includes(
                                  friend.id
                                )}
                                onChange={() =>
                                  toggleFriend(
                                    item,
                                    friend.id
                                  )
                                }
                              />

                              {friend.name}
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {!itemIsValid(item) && (
                    <p className="validation-message">
                      <AlertTriangle size={16} />
                      Complete the assignment
                      for this dish.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        {/* FINAL SPLIT SUMMARY */}
        <aside className="panel summary-panel">
          <h2 className="panel-title">
            <ReceiptText size={22} />
            Final Split
          </h2>

          <div className="summary-total">
            <span>
              Total Restaurant Bill
            </span>

            <strong>
              {receipt
                ? formatMoney(
                    receipt.grandTotal
                  )
                : "—"}
            </strong>

            <small>
              {friends.length} friends
            </small>
          </div>

          {!valid ? (
            <p className="validation-message">
              Add friends and complete the
              assignment for every food
              item to see the final split.
            </p>
          ) : (
            <div className="summary-list">
              {friends.map(
                (friend, index) => (
                  <div
                    className="summary-person"
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

                        <small
                          style={{
                            display: "block",
                          }}
                        >
                          Food:{" "}
                          {formatMoney(
                            foodShares[
                              friend.id
                            ]
                          )}
                          {" · "}
                          Tax:{" "}
                          {formatMoney(
                            taxShares[
                              friend.id
                            ]
                          )}
                          {" · "}
                          Other:{" "}
                          {formatMoney(
                            otherShares[
                              friend.id
                            ]
                          )}
                        </small>
                      </div>
                    </div>

                    <strong>
                      {formatMoney(
                        balances[friend.id]
                      )}
                    </strong>
                  </div>
                )
              )}

              <div className="summary-total">
                <span>
                  Total distributed
                </span>

                <strong>
                  {formatMoney(
                    distributedTotal
                  )}
                </strong>
              </div>

              <p
                className={
                  totalsMatch
                    ? "review-match"
                    : "review-mismatch"
                }
              >
                {totalsMatch ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}

                {totalsMatch
                  ? "All shares add up to the restaurant bill."
                  : "The calculated shares do not match the bill."}
              </p>
            </div>
          )}

          <div className="summary-note">
            <CheckCircle2 size={18} />

            <span>
              Food is split according to
              assignments. Taxes and other
              adjustments are divided
              equally among all friends.
            </span>
          </div>

          {/* CONTINUE TO SETTLEMENT */}
          {totalsMatch && (
            <button
              type="button"
              className="small-button"
              onClick={
                continueToSettlement
              }
            >
              <Wallet size={18} />
              Continue to Settlement
              <ArrowRight size={18} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
