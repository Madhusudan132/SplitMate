
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ReceiptText,
  UsersRound,
  UtensilsCrossed,
  Zap,
  Smartphone,
  Smile,
  Sparkles,
} from "lucide-react";

const features = [
  {
    title: "Split by Items",
    description: "Who had what",
    Icon: UtensilsCrossed,
    className: "neo-feature-green",
    to: "/split",
  },
  {
    title: "Group Bills",
    description: "Dine, split, settle",
    Icon: UsersRound,
    className: "neo-feature-pink",
    to: "/split",
  },
  {
    title: "Fair Calculation",
    description: "No more confusion",
    Icon: Zap,
    className: "neo-feature-cyan",
    to: "/split",
  },
  {
    title: "PWA Ready",
    description: "Use like an app",
    Icon: Smartphone,
    className: "neo-feature-white",
    to: "/scan",
  },
];

export default function Home() {
  return (
    <div className="neo-home">
      <section className="neo-hero">
        <div className="neo-hero-content">
          <div className="neo-eyebrow">
            <Sparkles size={17} />
            THE FUN WAY TO SPLIT
          </div>

          <h1 className="neo-hero-title">
            SPLIT BILLS
            <br />
            FAIR &amp; FAST
            <span className="neo-title-burst">
              <i />
              <i />
              <i />
            </span>
          </h1>

          <p className="neo-hero-description">
            The smart way to split restaurant bills
            with friends — no more awkward math!
          </p>

          <div className="neo-hero-actions">
            <Link
              to="/scan"
              className="neo-btn neo-btn-pink"
            >
              Create a Bill
              <ArrowRight size={20} />
            </Link>

            <Link
              to="/history"
              className="neo-btn neo-btn-white"
            >
              My Bills
              <ReceiptText size={19} />
            </Link>
          </div>

          <p className="neo-hero-footnote">
            <Check size={17} />
            Scan, split, and settle with ease
          </p>
        </div>

        <div
          className="neo-hero-art"
          aria-label="Decorative restaurant receipt illustration"
        >
          <div className="neo-receipt-back" />

          <div className="neo-receipt">
            <h2>RESTAURANT</h2>
            <div className="neo-receipt-rule" />

            <div className="neo-receipt-row">
              <span>Paneer Tikka</span>
              <strong>₹320</strong>
            </div>

            <div className="neo-receipt-row">
              <span>Fried Rice</span>
              <strong>₹280</strong>
            </div>

            <div className="neo-receipt-row">
              <span>Mocktail</span>
              <strong>₹180</strong>
            </div>

            <div className="neo-receipt-dashes" />

            <div className="neo-receipt-total">
              <span>Total</span>
              <strong>₹780</strong>
            </div>
          </div>

          <div className="neo-smiley">
            <Smile size={62} strokeWidth={2.4} />
          </div>

          <div className="neo-art-spark neo-art-spark-one">
            ✳
          </div>

          <div className="neo-art-spark neo-art-spark-two">
            ✦
          </div>
        </div>
      </section>

      <section
        className="neo-features"
        aria-label="SplitMate features"
      >
        {features.map(
          ({ title, description, Icon, className, to }) => (
            <Link
              to={to}
              className={`neo-feature ${className}`}
              key={title}
            >
              <Icon
                size={32}
                strokeWidth={2.5}
                aria-hidden="true"
              />

              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </Link>
          )
        )}
      </section>
    </div>
  );
}
