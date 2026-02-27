import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "./api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetLink(null);
    setLoading(true);
    try {
      const res = await auth.forgotPassword(email);
      setMessage(res.message);
      if (res.resetLink) setResetLink(res.resetLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>איפוס סיסמה</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        הזינו את כתובת האימייל שלכם ונשלח אליכם קישור לאיפוס הסיסמה.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="forgot-email">אימייל</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        {resetLink && (
          <p style={{ marginTop: "0.5rem" }}>
            <a href={resetLink} target="_blank" rel="noopener noreferrer">
              לחצו כאן לאיפוס הסיסמה
            </a>
          </p>
        )}
        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loading}>
          {loading ? "שולח..." : "שליחת קישור"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/login">חזרה להתחברות</Link>
      </p>
    </div>
  );
}
