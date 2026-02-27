import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-context";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, phone || undefined);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>הרשמה</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="reg-email">אימייל</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-password">סיסמה</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-phone">טלפון (אופציונלי)</label>
          <input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loading}>
          {loading ? "נרשם..." : "הרשמה"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        כבר רשומים? <Link to="/login">התחברות</Link>
      </p>
    </div>
  );
}
