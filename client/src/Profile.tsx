import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-context";
import { users, uploadImage, imageUrl } from "./api";

const PROFILE_FREE_TEXT_SECTIONS = {
  location: "מיקום, איפה ומתי מעוניינים לרקוד",
  experience: "נסיון ומה רוקדים ויודעים",
  feedback: "דעתכם על הרעיון והצעות",
} as const;

function buildFreeText(payload: {
  locationText: string;
  experienceText: string;
  feedbackText: string;
}): string {
  const { locationText, experienceText, feedbackText } = payload;
  return [
    `${PROFILE_FREE_TEXT_SECTIONS.location}:\n${locationText.trim()}`,
    `${PROFILE_FREE_TEXT_SECTIONS.experience}:\n${experienceText.trim()}`,
    `${PROFILE_FREE_TEXT_SECTIONS.feedback}:\n${feedbackText.trim()}`,
  ].join("\n\n");
}

function parseFreeText(source: string): {
  locationText: string;
  experienceText: string;
  feedbackText: string;
} {
  const locationMatch = source.match(
    new RegExp(
      `${PROFILE_FREE_TEXT_SECTIONS.location}:\\s*([\\s\\S]*?)(?=\\n\\n${PROFILE_FREE_TEXT_SECTIONS.experience}:|$)`,
    ),
  );
  const experienceMatch = source.match(
    new RegExp(
      `${PROFILE_FREE_TEXT_SECTIONS.experience}:\\s*([\\s\\S]*?)(?=\\n\\n${PROFILE_FREE_TEXT_SECTIONS.feedback}:|$)`,
    ),
  );
  const feedbackMatch = source.match(
    new RegExp(`${PROFILE_FREE_TEXT_SECTIONS.feedback}:\\s*([\\s\\S]*)$`),
  );

  if (locationMatch || experienceMatch || feedbackMatch) {
    return {
      locationText: locationMatch?.[1]?.trim() ?? "",
      experienceText: experienceMatch?.[1]?.trim() ?? "",
      feedbackText: feedbackMatch?.[1]?.trim() ?? "",
    };
  }

  // Backward compatibility for existing one-field profiles.
  return {
    locationText: source.trim(),
    experienceText: "",
    feedbackText: "",
  };
}

export default function Profile() {
  const { auth, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [locationText, setLocationText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
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
      const parsed = parseFreeText(auth.profile.freeText ?? "");
      setLocationText(parsed.locationText);
      setExperienceText(parsed.experienceText);
      setFeedbackText(parsed.feedbackText);
    }
  }, [auth.loading, auth.token, auth.profile, navigate]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await users.updateMe({
        phone,
        freeText: buildFreeText({ locationText, experienceText, feedbackText }),
      });
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
          <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            בכל השאלות ניתן לענות בטקסט חופשי.
          </p>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="profile-location-text">{PROFILE_FREE_TEXT_SECTIONS.location}</label>
              <textarea
                id="profile-location-text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="עיר/אזור, ימים ושעות מועדפים..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="profile-experience-text">{PROFILE_FREE_TEXT_SECTIONS.experience}</label>
              <textarea
                id="profile-experience-text"
                value={experienceText}
                onChange={(e) => setExperienceText(e.target.value)}
                placeholder="רמת ניסיון, סגנונות וריקודים שאתם מכירים..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="profile-feedback-text">{PROFILE_FREE_TEXT_SECTIONS.feedback}</label>
              <textarea
                id="profile-feedback-text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="רעיונות, הערות והצעות לשיפור..."
              />
            </div>
          </div>
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
