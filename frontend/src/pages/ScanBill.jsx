
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Upload,
  ImagePlus,
  ScanText,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LoaderCircle,
  Plus,
  Trash2,
  Save,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api/scan-receipt/";
const STORAGE_KEY = "splitmate_reviewed_receipt";

const CHARGES = [
  { key: "cgst", label: "CGST" },
  { key: "sgst", label: "SGST" },
  { key: "igst", label: "IGST" },
  { key: "service_charge", label: "Service charge" },
  { key: "discount", label: "Discount" },
  { key: "round_off", label: "Rounding adjustment" },
];

const emptyCharges = {
  cgst: "0.00",
  sgst: "0.00",
  igst: "0.00",
  service_charge: "0.00",
  discount: "0.00",
  round_off: "0.00",
};

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

function asAmount(paise) {
  return (paise / 100).toFixed(2);
}

function money(paise) {
  if (paise === null || !Number.isFinite(paise)) {
    return "—";
  }

  const negative = paise < 0 ? "-" : "";

  return `${negative}₹${(
    Math.abs(paise) / 100
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function makeItem(item = {}) {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name: String(item.name ?? ""),
    quantity: String(item.quantity ?? 1),
    total_price:
      item.total_price == null
        ? ""
        : String(item.total_price),
    raw_price: item.raw_price ?? "",
    needs_review: Boolean(item.needs_review),
  };
}

function getInitialCharges(summary = {}) {
  const result = { ...emptyCharges };

  for (const { key } of CHARGES) {
    const value = summary[key];

    if (value !== null && value !== undefined) {
      result[key] = String(value);
    }
  }

  return result;
}

export default function ScanBill() {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  const [image, setImage] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const [scanResult, setScanResult] = useState(null);
  const [reviewItems, setReviewItems] = useState([]);

  const [expectedSubtotal, setExpectedSubtotal] =
    useState("");

  const [charges, setCharges] = useState({
    ...emptyCharges,
  });

  const [expectedTotal, setExpectedTotal] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image);
    };
  }, [image]);

  function resetReview() {
    setScanResult(null);
    setReviewItems([]);
    setExpectedSubtotal("");
    setCharges({ ...emptyCharges });
    setExpectedTotal("");
    setConfirmed(false);
    setSaved(false);
  }

  function invalidateConfirmation() {
    setConfirmed(false);
    setSaved(false);
  }

  function handleImage(event) {
    const selected = event.target.files?.[0];
    event.target.value = "";

    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");
      return;
    }

    resetReview();
    setError("");
    setFile(selected);
    setImage(URL.createObjectURL(selected));
  }

  function removeImage() {
    if (scanning) return;

    setFile(null);
    setImage(null);
    setError("");
    resetReview();
  }

  async function scanReceipt() {
    if (!file || scanning) {
      if (!file) {
        setError("Please select a receipt first.");
      }
      return;
    }

    setScanning(true);
    setError("");
    resetReview();

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error ||
            data.message ||
            "Failed to scan the receipt."
        );
      }

      setScanResult(data);

      const items = Array.isArray(data.items)
        ? data.items
        : [];

      setReviewItems(items.map(makeItem));

      const summary = data.summary ?? {};

      // The derived subtotal is only a starting
      // value. The user must verify it.
      setExpectedSubtotal(
        String(
          summary.subtotal ??
            data.validation?.expected_amount ??
            ""
        )
      );

      setCharges(getInitialCharges(summary));

      // Never substitute the food subtotal for
      // an unreadable printed grand total.
      setExpectedTotal(
        summary.total == null
          ? ""
          : String(summary.total)
      );
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to Django. Check the backend."
          : err.message || "Unable to scan receipt."
      );
    } finally {
      setScanning(false);
    }
  }

  function updateItem(id, field, value) {
    setReviewItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );

    invalidateConfirmation();
  }

  function addItem() {
    setReviewItems((current) => [
      ...current,
      makeItem({
        name: "",
        quantity: 1,
        total_price: "",
        needs_review: true,
      }),
    ]);

    invalidateConfirmation();
  }

  function removeItem(id) {
    setReviewItems((current) =>
      current.filter((item) => item.id !== id)
    );

    invalidateConfirmation();
  }

  function updateCharge(key, value) {
    setCharges((current) => ({
      ...current,
      [key]: value,
    }));

    invalidateConfirmation();
  }

  const itemProblems = reviewItems.map((item) => {
    const problems = [];

    if (!item.name.trim()) {
      problems.push("Enter a food name.");
    }

    const quantity = Number(item.quantity);

    if (
      !/^\d+$/.test(item.quantity) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      problems.push("Enter a valid quantity.");
    }

    if (toPaise(item.total_price) === null) {
      problems.push("Enter a valid line total.");
    }

    return problems;
  });

  const allItemsValid =
    reviewItems.length > 0 &&
    itemProblems.every((problems) => problems.length === 0);

  // total_price is already the line total.
  // Do not multiply by quantity again.
  const foodSubtotal = reviewItems.reduce(
    (sum, item) => sum + (toPaise(item.total_price) ?? 0),
    0
  );

  const printedSubtotal = toPaise(expectedSubtotal);

  const subtotalMatches =
    allItemsValid &&
    printedSubtotal !== null &&
    foodSubtotal === printedSubtotal;

  const chargePaise = Object.fromEntries(
    CHARGES.map(({ key }) => [
      key,
      toPaise(charges[key], key === "round_off"),
    ])
  );

  const chargesValid = Object.values(chargePaise).every(
    (value) => value !== null
  );

  const taxes =
    (chargePaise.cgst ?? 0) +
    (chargePaise.sgst ?? 0) +
    (chargePaise.igst ?? 0);

  const serviceCharge = chargePaise.service_charge ?? 0;
  const discount = chargePaise.discount ?? 0;
  const roundOff = chargePaise.round_off ?? 0;

  const calculatedTotal =
    foodSubtotal +
    taxes +
    serviceCharge -
    discount +
    roundOff;

  const printedTotal = toPaise(expectedTotal);

  const totalMatches =
    allItemsValid &&
    chargesValid &&
    printedTotal !== null &&
    calculatedTotal >= 0 &&
    calculatedTotal === printedTotal;

  const canConfirm =
    !scanning &&
    subtotalMatches &&
    totalMatches &&
    confirmed;

  function saveReviewedReceipt() {
    if (!canConfirm) return;

    const reviewedItems = reviewItems.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      total_price: asAmount(toPaise(item.total_price)),
      needs_review: false,
    }));

    const reviewedSummary = {
      subtotal: asAmount(foodSubtotal),
      cgst: asAmount(chargePaise.cgst),
      sgst: asAmount(chargePaise.sgst),
      igst: asAmount(chargePaise.igst),
      service_charge: asAmount(serviceCharge),
      discount: asAmount(discount),
      round_off: asAmount(roundOff),
      total: asAmount(calculatedTotal),
    };

    const receipt = {
      items: reviewedItems,
      subtotal: reviewedSummary.subtotal,
      summary: reviewedSummary,
      grand_total: reviewedSummary.total,
      confirmed_at: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(receipt)
      );

      setSaved(true);
      setError("");
    } catch {
      setSaved(false);
      setError(
        "Unable to save the reviewed receipt in this browser."
      );
    }
  }

  return (
    <div className="scan-page">
      <div className="scan-header">
        <span className="section-label">
          SMART RECEIPT SCANNER
        </span>

        <h1>Scan Your Restaurant Bill</h1>

        <p>
          Upload your receipt, review food items and taxes,
          then confirm the final amount before splitting.
        </p>
      </div>

      <div className="scanner-card">
        {!image ? (
          <div className="scanner-empty">
            <div className="scanner-icon">
              <ScanText size={45} />
            </div>

            <h2>Upload Your Receipt</h2>

            <p>
              Capture a clear photo of your restaurant bill.
            </p>

            <div className="scanner-actions">
              <button
                type="button"
                className="camera-button"
                onClick={() => cameraRef.current?.click()}
                disabled={scanning}
              >
                <Camera size={20} />
                Open Camera
              </button>

              <button
                type="button"
                className="upload-button"
                onClick={() => uploadRef.current?.click()}
                disabled={scanning}
              >
                <Upload size={20} />
                Upload Image
              </button>
            </div>

            <div className="scanner-hint">
              <ImagePlus size={18} />
              Supports JPG, PNG and browser-supported images
            </div>
          </div>
        ) : (
          <div className="scanner-preview">
            <div className="preview-heading">
              <h2>Receipt Preview</h2>

              <button
                type="button"
                className="remove-image"
                onClick={removeImage}
                disabled={scanning}
                aria-label="Remove receipt"
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={image}
              alt="Restaurant receipt"
              className="receipt-image"
            />

            <div className="upload-success">
              <CheckCircle2 size={18} />
              Receipt image selected
            </div>
          </div>
        )}

        <button
          type="button"
          className="scan-button"
          onClick={scanReceipt}
          disabled={!file || scanning}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            width: "100%",
            maxWidth: "420px",
            margin: "24px auto",
            padding: "16px 24px",
            background: "#0077B6",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "14px",
            fontSize: "16px",
            fontWeight: "600",
            cursor:
              !file || scanning ? "not-allowed" : "pointer",
            opacity: !file || scanning ? 0.55 : 1,
          }}
        >
          {scanning ? (
            <>
              <LoaderCircle
                size={20}
                className="scan-spinner"
              />
              Scanning Receipt...
            </>
          ) : (
            <>
              <ScanText size={20} />
              Scan Receipt
            </>
          )}
        </button>

        {!file && (
          <p style={{ textAlign: "center", opacity: 0.65 }}>
            Upload a receipt to enable scanning.
          </p>
        )}

        {error && (
          <p className="scanner-error" role="alert">
            <AlertCircle size={18} />
            {error}
          </p>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
          disabled={scanning}
          hidden
        />

        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          onChange={handleImage}
          disabled={scanning}
          hidden
        />
      </div>

      {scanResult && (
        <div className="ocr-results">
          <div className="ocr-results-header">
            <div>
              <span className="section-label">
                OCR RESULTS
              </span>

              <h2>Review Your Receipt</h2>

              <p>
                Verify the items, taxes and final amount
                against your original receipt.
              </p>
            </div>

            <div className="ocr-success">
              <CheckCircle2 size={18} />
              Scan Complete
            </div>
          </div>

          <div className="review-warning">
            <AlertTriangle size={20} />
            <p>
              OCR may misread amounts. Check every item,
              tax, discount and the printed grand total.
            </p>
          </div>

          {reviewItems.length > 0 ? (
            <div className="review-items">
              {reviewItems.map((item, index) => (
                <div className="review-item" key={item.id}>
                  <div className="review-item-heading">
                    <span>Item {index + 1}</span>

                    <button
                      type="button"
                      className="review-delete"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <div className="review-item-fields">
                    <label className="review-name-field">
                      Food name
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "name",
                            event.target.value
                          )
                        }
                        placeholder="Food item"
                      />
                    </label>

                    <label>
                      Quantity
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "quantity",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Line total (₹)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.total_price}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "total_price",
                            event.target.value
                          )
                        }
                        placeholder="0.00"
                      />
                    </label>
                  </div>

                  {item.needs_review && (
                    <p className="review-item-alert">
                      <AlertTriangle size={15} />
                      OCR flagged this item.
                      {item.raw_price &&
                        ` Raw reading: ${item.raw_price}`}
                    </p>
                  )}

                  {itemProblems[index].length > 0 && (
                    <p className="review-item-alert">
                      <AlertCircle size={15} />
                      {itemProblems[index].join(" ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="ocr-empty">
              <AlertCircle size={24} />
              <h3>No food items detected</h3>
              <p>Add the items manually below.</p>
            </div>
          )}

          <button
            type="button"
            className="review-add-button"
            onClick={addItem}
          >
            <Plus size={18} />
            Add Food Item
          </button>

          <div className="review-summary">
            <h3>Receipt Summary</h3>

            <div className="review-summary-row">
              <span>Calculated food subtotal</span>
              <strong>{money(foodSubtotal)}</strong>
            </div>

            <label className="review-subtotal-field">
              Printed food subtotal (₹)
              <input
                type="text"
                inputMode="decimal"
                value={expectedSubtotal}
                onChange={(event) => {
                  setExpectedSubtotal(event.target.value);
                  invalidateConfirmation();
                }}
                placeholder="Enter printed subtotal"
              />
            </label>

            {scanResult.summary?.subtotal_needs_review && (
              <p className="review-item-alert">
                <AlertTriangle size={15} />
                The printed subtotal was unreadable.
                Verify the value manually.
              </p>
            )}

            <p
              className={
                subtotalMatches
                  ? "review-match"
                  : "review-mismatch"
              }
            >
              {subtotalMatches ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
              {subtotalMatches
                ? "Food subtotal matches."
                : "Food subtotal needs verification."}
            </p>

            <h3 style={{ marginTop: "28px" }}>
              Taxes & Adjustments
            </h3>

            <div className="review-tax-grid">
              {CHARGES.map(({ key, label }) => (
                <label
                  className="review-tax-field"
                  key={key}
                >
                  {label} (₹)
                  <input
                    type="text"
                    inputMode={
                      key === "round_off"
                        ? "text"
                        : "decimal"
                    }
                    value={charges[key]}
                    onChange={(event) =>
                      updateCharge(key, event.target.value)
                    }
                    placeholder="0.00"
                  />
                </label>
              ))}
            </div>

            <p className="review-small-note">
              Discounts are subtracted. Rounding
              adjustments may be positive or negative.
              Verify any unreadable taxes or charges
              against the receipt.
            </p>

            <div className="review-summary-row">
              <span>Total taxes</span>
              <strong>{money(taxes)}</strong>
            </div>

            <div className="review-summary-row">
              <span>Service charge</span>
              <strong>{money(serviceCharge)}</strong>
            </div>

            <div className="review-summary-row">
              <span>Discount</span>
              <strong>-{money(discount)}</strong>
            </div>

            <div className="review-summary-row">
              <span>Rounding adjustment</span>
              <strong>{money(roundOff)}</strong>
            </div>

            <div className="review-summary-row review-grand-total">
              <span>Calculated grand total</span>
              <strong>
                {allItemsValid &&
                chargesValid &&
                calculatedTotal >= 0
                  ? money(calculatedTotal)
                  : "—"}
              </strong>
            </div>

            <label className="review-subtotal-field">
              Printed grand total (₹)
              <input
                type="text"
                inputMode="decimal"
                value={expectedTotal}
                onChange={(event) => {
                  setExpectedTotal(event.target.value);
                  invalidateConfirmation();
                }}
                placeholder="Enter final receipt amount"
              />
            </label>

            <p
              className={
                totalMatches
                  ? "review-match"
                  : "review-mismatch"
              }
            >
              {totalMatches ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}

              {totalMatches
                ? "Grand total matches the receipt."
                : "Verify the grand total, taxes and adjustments."}
            </p>

            <p className="review-small-note">
              Item prices are line totals, not unit
              prices. The final amount includes taxes
              and adjustments.
            </p>
          </div>

          <div className="review-confirm-section">
            <label className="review-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  setSaved(false);
                }}
              />

              <span>
                I have checked all food items, quantities,
                taxes, charges, discounts and the final
                amount against the original receipt.
              </span>
            </label>

            <button
              type="button"
              className="review-save-button"
              onClick={saveReviewedReceipt}
              disabled={!canConfirm}
            >
              <Save size={19} />
              Confirm Reviewed Receipt
            </button>

            {saved && (
              <div className="review-saved" role="status">
                <CheckCircle2 size={20} />
                Receipt confirmed and saved with taxes
                and the final payable amount.
              </div>
            )}

            <p className="review-small-note">
              The reviewed receipt will be used by
              the Split Bill page in the next step.
            </p>
          </div>

          <details className="ocr-raw-details">
            <summary>
              View Recognized Receipt Text
            </summary>
            <pre>
              {scanResult.raw_text || "No text detected."}
            </pre>
          </details>

          {scanResult.price_candidates?.length > 0 && (
            <details className="ocr-raw-details">
              <summary>
                View Alternative OCR Price Readings
              </summary>
              <pre>
                {JSON.stringify(
                  scanResult.price_candidates,
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="scanner-tips">
        <h3>Tips for Better Scanning</h3>
        <p>✓ Place the receipt on a flat surface.</p>
        <p>✓ Make sure the text is clearly visible.</p>
        <p>✓ Avoid shadows and blurry photos.</p>
        <p>✓ Capture the entire receipt.</p>
      </div>
    </div>
  );
}
