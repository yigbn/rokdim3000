import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-context";
import { users, uploadImage, imageUrl } from "./api";

export default function Profile() {
  const { auth, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      navigate("/login");
      return;
    }
    if (auth.profile) {
      setPhone(auth.profile.phone ?? "");
      setFreeText(auth.profile.freeText ?? "");
    }
  }, [auth.loading, auth.token, auth.profile, navigate]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await users.updateMe({ phone, freeText });
      setMessage("הפרופיל עודכן");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      await uploadImage(file);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת תמונה");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (auth.loading) {
    return (
      <div className="section container">
        <p>טוען...</p>
      </div>
    );
  }

  if (!auth.token) return null;

  return (
    <div className="section container" style={{ maxWidth: "560px" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>הפרופיל שלי</h1>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 8,
              background: "var(--border)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {auth.profile?.imagePath ? (
              <img
                src={imageUrl(auth.profile.imagePath)}
                alt="תמונת פרופיל"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                אין תמונה
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "מעלה..." : auth.profile?.imagePath ? "החלפת תמונה" : "העלאת תמונה"}
            </button>
          </div>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}>אימייל: {auth.profile?.email}</p>

      <form onSubmit={handleSaveProfile}>
        <div className="form-group">
          <label htmlFor="profile-phone">טלפון</label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div className="form-group">
          <label htmlFor="profile-freetext">
            טקסט חופשי — ניסיון, מיקום, איפה ומתי מעוניינים לרקוד, מה אתם יודעים, דעתכם על הרעיון
          </label>
          <textarea
            id="profile-freetext"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="כתבו כאן כל מה שרלוונטי לריקודי עם..."
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "שומר..." : "שמירה"}
        </button>
      </form>

      <p style={{ marginTop: "2rem" }}>
        <Link to="/">חזרה לדף הבית</Link>
      </p>
    </div>
  );
}
