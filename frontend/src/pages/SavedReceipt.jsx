
import { useState } from "react";

import {
  ReceiptText,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";


function money(paise) {
  const amount = Number(paise) || 0;

  const prefix = amount < 0 ? "−" : "";

  return `${prefix}₹${(
    Math.abs(amount) / 100
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}


const splitLabels = {
  individual: "Individual",
  shared: "Shared equally",
  common: "Common (everyone)",
  quantity: "By quantity",
};


export default function SavedReceipt({
  receiptData,
  grandTotal,
  friends = [],
}) {
  const [open, setOpen] = useState(false);

  const receipt =
    receiptData &&
    typeof receiptData === "object" &&
    !Array.isArray(receiptData)
      ? receiptData
      : {};

  const items = Array.isArray(receipt.items)
    ? receipt.items
    : [];

  const names = Object.fromEntries(
    friends.map((friend) => [
      friend.id,
      friend.name,
    ])
  );

  const hasReceipt = items.length > 0;

  const adjustments = [
    ["CGST", receipt.cgst],
    ["SGST", receipt.sgst],
    ["IGST", receipt.igst],
    ["Service Charge", receipt.serviceCharge],
    [
      "Discount",
      receipt.discount == null
        ? null
        : -receipt.discount,
    ],
    ["Round Off", receipt.roundOff],
  ];


  return (
    <section className="panel history-receipt-panel">

      <h2 className="panel-title">
        <ReceiptText size={22} />
        Original Receipt
      </h2>

      {!hasReceipt ? (
        <p className="history-muted-text">
          Receipt details were not saved for
          this bill. Your settlement details
          are still available.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="small-button"
            onClick={() =>
              setOpen((current) => !current)
            }
            aria-expanded={open}
          >
            <ReceiptText size={17} />

            {open
              ? "Hide Receipt"
              : "View Receipt"}

            {open ? (
              <ChevronUp size={17} />
            ) : (
              <ChevronDown size={17} />
            )}
          </button>

          {open && (
            <div className="history-receipt-content">

              <h3>Receipt Items</h3>

              <div className="history-detail-list">

                {items.map((item, index) => {
                  const assignedNames = (
                    item.selected ?? []
                  ).map(
                    (id) => names[id] ?? id
                  );

                  const quantityAssignments =
                    Object.entries(
                      item.allocations ?? {}
                    )
                      .filter(
                        ([, count]) =>
                          Number(count) > 0
                      )
                      .map(
                        ([id, count]) =>
                          `${names[id] ?? id}: ${count}`
                      );

                  return (
                    <div
                      className="history-detail-row"
                      key={`${item.name}-${index}`}
                    >
                      <span>
                        <strong>
                          {item.name || "Item"}
                        </strong>

                        {" × "}
                        {item.quantity ?? 1}

                        <small
                          style={{
                            display: "block",
                            opacity: 0.7,
                            marginTop: 5,
                          }}
                        >
                          <Users
                            size={13}
                            style={{
                              verticalAlign: "middle",
                            }}
                          />

                          {" "}
                          {splitLabels[item.type] ??
                            "Shared"}

                          {assignedNames.length > 0 &&
                            ` · ${assignedNames.join(", ")}`}

                          {quantityAssignments.length > 0 &&
                            ` · ${quantityAssignments.join(", ")}`}
                        </small>
                      </span>

                      <strong>
                        {money(item.totalPaise ?? 0)}
                      </strong>
                    </div>
                  );
                })}

              </div>


              <h3>Receipt Summary</h3>

              {receipt.subtotal != null && (
                <div className="history-detail-row">
                  <span>Subtotal</span>

                  <strong>
                    {money(receipt.subtotal)}
                  </strong>
                </div>
              )}

              {adjustments
                .filter(
                  ([, amount]) =>
                    amount != null &&
                    amount !== 0
                )
                .map(([label, amount]) => (
                  <div
                    className="history-detail-row"
                    key={label}
                  >
                    <span>{label}</span>

                    <strong>
                      {money(amount)}
                    </strong>
                  </div>
                ))}

              <div className="history-detail-row">
                <span>
                  <strong>Grand Total</strong>
                </span>

                <strong>
                  {money(grandTotal)}
                </strong>
              </div>

            </div>
          )}
        </>
      )}

    </section>
  );
}
