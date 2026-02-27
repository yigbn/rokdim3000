import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { auth } from "./api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirm) {
      setError("הסיסמאות לא תואמות");
      return;
    }
    if (newPassword.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (!token) {
      setError("חסר קישור איפוס — בקשו קישור חדש מעמוד שכחתי סיסמה");
      return;
    }
    setLoading(true);
    try {
      await auth.resetPassword(token, newPassword);
      setMessage("הסיסמה עודכנה בהצלחה. אפשר להתחבר כעת.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה באיפוס");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>סיסמה חדשה</h1>
      {!token && (
        <p className="error-msg">
          לא התקבל קישור איפוס. גשו ל
          <Link to="/forgot-password"> איפוס סיסמה</Link> ובקשו קישור חדש.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="new-password">סיסמה חדשה</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">אימות סיסמה</label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loading || !token}>
          {loading ? "מעדכן..." : "עדכון סיסמה"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/login">חזרה להתחברות</Link>
      </p>
    </div>
  );
}
