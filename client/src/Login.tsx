import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-context";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>התחברות</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-email">אימייל</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">סיסמה</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "מתחבר..." : "התחבר"}
          </button>
          <Link to="/forgot-password" style={{ alignSelf: "center" }}>
            שכחתי סיסמה
          </Link>
        </div>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        עדיין לא רשומים? <Link to="/register">הרשמה</Link>
      </p>
    </div>
  );
}
