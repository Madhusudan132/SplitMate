
import { Link } from "react-router-dom";

function Home() {
  return (
    <section className="hero">
      <div>
        <h1>
          Eat Together.
          <br />
          Split <span>Smarter.</span>
        </h1>

        <p>
          Welcome to SplitMate! Split restaurant bills fairly
          based on what everyone actually ordered.
        </p>

        <Link to="/split" className="primary-button">
          Start Splitting
        </Link>
      </div>
    </section>
  );
}

export default Home;
