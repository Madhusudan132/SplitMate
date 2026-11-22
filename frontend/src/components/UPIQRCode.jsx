
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  QrCode,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Link2,
  ShieldCheck,
} from "lucide-react";

const UPI_ID_PATTERN =
  /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;

function formatAmount(paise) {
  return (paise / 100).toFixed(2);
}

export default function UPIQRCode({
  recipientName,
  amount,
  upiId = "",
  onUpiIdChange,
}) {
  const [copied, setCopied] = useState("");

  const validAmount =
    Number.isSafeInteger(amount) &&
    amount > 0;

  const cleanUpiId = upiId.trim();

  const validUpiId =
    cleanUpiId.length <= 120 &&
    UPI_ID_PATTERN.test(cleanUpiId);

  const canGenerate =
    validAmount && validUpiId;

  const upiUrl = canGenerate
    ? `upi://pay?${new URLSearchParams({
        pa: cleanUpiId,
        pn: recipientName || "Recipient",
        am: formatAmount(amount),
        cu: "INR",
        tn: "SplitMate Bill Settlement",
      }).toString()}`
    : "";

  useEffect(() => {
    setCopied("");
  }, [upiUrl]);

  async function copyText(value, type) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );

      setCopied(type);
    } catch {
      setCopied("");
    }
  }

  function openUpiApp() {
    if (!canGenerate) return;

    window.location.href = upiUrl;
  }

  return (
    <div
      className="upi-qr-card"
      style={{
        marginTop: 16,
        padding: 16,
        border:
          "1px solid var(--border, #ddd)",
        borderRadius: 16,
      }}
    >
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <QrCode size={20} />
        Pay with UPI
      </h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 12,
        }}
      >
        <p>
          Recipient:{" "}
          <strong>
            {recipientName}
          </strong>
        </p>

        <p>
          Amount:{" "}
          <strong>
            ₹
            {validAmount
              ? formatAmount(amount)
              : "0.00"}
          </strong>
        </p>
      </div>

      {/* RECIPIENT UPI ID */}
      <label
        style={{
          display: "block",
          marginTop: 14,
        }}
      >
        Recipient UPI ID

        <input
          type="text"
          value={upiId}
          placeholder="example@upi"
          onChange={(event) =>
            onUpiIdChange?.(
              event.target.value
            )
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{
            display: "block",
            boxSizing: "border-box",
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
          }}
        />
      </label>

      {!validUpiId &&
        cleanUpiId.length > 0 && (
          <p
            className="validation-message"
            role="alert"
            style={{
              marginTop: 10,
            }}
          >
            <AlertTriangle size={16} />
            Enter a valid UPI ID.
          </p>
        )}

      {canGenerate ? (
        <>
          {/* UPI QR CODE */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 20,
              padding: 16,
              background: "#ffffff",
              borderRadius: 12,
            }}
          >
            <QRCodeSVG
              value={upiUrl}
              size={220}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#111111"
              style={{
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </div>

          <p
            style={{
              textAlign: "center",
              marginTop: 12,
              fontSize: 13,
              opacity: 0.8,
            }}
          >
            Scan this QR code using
            any supported UPI app.
          </p>

          {/* MOBILE UPI PAYMENT */}
          <a
            href={upiUrl}
            className="small-button"
            onClick={(event) => {
              if (!canGenerate) {
                event.preventDefault();
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              boxSizing: "border-box",
              marginTop: 16,
              padding: "13px 16px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            <Smartphone size={18} />
            Pay via UPI
          </a>

          {/* COPY OPTIONS */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="small-button"
              onClick={() =>
                copyText(
                  cleanUpiId,
                  "upi"
                )
              }
              style={{
                flex: "1 1 130px",
              }}
            >
              {copied === "upi" ? (
                <CheckCircle2
                  size={16}
                />
              ) : (
                <Copy size={16} />
              )}

              {copied === "upi"
                ? "UPI ID Copied"
                : "Copy UPI ID"}
            </button>

            <button
              type="button"
              className="small-button"
              onClick={() =>
                copyText(
                  upiUrl,
                  "link"
                )
              }
              style={{
                flex: "1 1 130px",
              }}
            >
              {copied === "link" ? (
                <CheckCircle2
                  size={16}
                />
              ) : (
                <Link2 size={16} />
              )}

              {copied === "link"
                ? "Link Copied"
                : "Copy Payment Link"}
            </button>
          </div>

          <p
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12,
              opacity: 0.8,
              marginTop: 16,
            }}
          >
            <ShieldCheck
              size={17}
              style={{
                flexShrink: 0,
              }}
            />

            Check the recipient's UPI
            identity and amount in your
            payment app before approving
            the transaction.
          </p>
        </>
      ) : (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            opacity: 0.8,
          }}
        >
          Enter the recipient's valid
          UPI ID to generate a QR code
          and payment link.
        </p>
      )}

      <p
        className="summary-note"
        style={{
          fontSize: 12,
          opacity: 0.75,
          marginTop: 14,
        }}
      >
        SplitMate does not initiate,
        process, or verify transactions.
        Payment confirmation must be
        completed manually after the
        recipient receives the money.
        The Pay via UPI button works
        only on devices and browsers
        that support UPI payment links.
      </p>
    </div>
  );
}
