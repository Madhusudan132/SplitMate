
import { Check, ScanLine, ClipboardCheck, UsersRound, Wallet } from "lucide-react";
import "./BillProgress.css";

const steps = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "split", label: "Split", icon: UsersRound },
  { id: "settle", label: "Settle", icon: Wallet },
];

export default function BillProgress({ currentStep = "scan" }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep)
  );

  return (
    <nav className="bill-progress" aria-label="Bill splitting progress">
      <div className="bill-progress-top">
        <span className="bill-progress-eyebrow">YOUR BILL JOURNEY</span>
        <span className="bill-progress-count">
          STEP {currentIndex + 1} OF {steps.length}
        </span>
      </div>

      <ol className="bill-progress-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <li
              key={step.id}
              className={[
                "bill-progress-step",
                isCurrent ? "is-current" : "",
                isComplete ? "is-complete" : "",
              ].filter(Boolean).join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="bill-progress-icon">
                {isComplete ? <Check size={19} strokeWidth={3} /> : <Icon size={19} />}
              </span>

              <span className="bill-progress-label">
                <span className="bill-progress-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{step.label}</strong>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

