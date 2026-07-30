import { useEffect, useMemo, useState, type FormEvent } from "react";
import { instructors, type InstructorSubmission } from "./api";

const TOKEN_STORAGE_KEY = "rokdim300_instructor_token";
const MAX_DANCES_PER_LIST = 300;

type InstructorSubmissionForm = {
  circleDances: string;
  coupleDances: string;
  notes: string;
};

function countDanceLines(value: string): number {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function toSubmissionForm(submission: InstructorSubmission): InstructorSubmissionForm {
  return {
    circleDances: submission.circleDances,
    coupleDances: submission.coupleDances,
    notes: submission.notes,
  };
}

export default function Instructors() {
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [submission, setSubmission] = useState<InstructorSubmissionForm>({
    circleDances: "",
    coupleDances: "",
    notes: "",
  });
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!authenticated) return;

    let ignore = false;
    setLoadingSubmission(true);
    setSaveError("");

    instructors
      .getSubmission()
      .then((data) => {
        if (!ignore) setSubmission(toSubmissionForm(data));
      })
      .catch((err) => {
        if (ignore) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setAuthenticated(false);
        setLoginError(err instanceof Error ? err.message : "כניסת המרקיד פגה");
      })
      .finally(() => {
        if (!ignore) setLoadingSubmission(false);
      });

    return () => {
      ignore = true;
    };
  }, [authenticated]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const { token } = await instructors.login(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "שגיאה בכניסה");
    } finally {
      setLoginLoading(false);
    }
  }

  const circleCount = useMemo(
    () => countDanceLines(submission.circleDances),
    [submission.circleDances],
  );
  const coupleCount = useMemo(
    () => countDanceLines(submission.coupleDances),
    [submission.coupleDances],
  );

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthenticated(false);
    setUsername("");
    setPassword("");
    setMessage("");
    setSaveError("");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaveError("");

    if (circleCount > MAX_DANCES_PER_LIST || coupleCount > MAX_DANCES_PER_LIST) {
      setSaveError("אפשר להזין עד 300 ריקודי מעגל ועד 300 ריקודי זוגות");
      return;
    }

    setSaving(true);
    try {
      const saved = await instructors.saveSubmission(submission);
      setSubmission(toSubmissionForm(saved));
      setMessage("הרשימות נשמרו בשרת. אפשר לחזור ולעדכן אותן בהמשך.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="section container" style={{ maxWidth: "460px" }}>
        <h1 style={{ marginBottom: "0.75rem" }}>כניסת מרקידים</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          בשלב הראשון מרקידים מוזמנים להיכנס ולהזין את הרפרטואר המרכזי שלהם:
          עד 300 ריקודי מעגל ועד 300 ריקודי זוגות, יחד עם הערות חופשיות.
        </p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="instructor-username">שם משתמש</label>
            <input
              id="instructor-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="instructor-password">סיסמה</label>
            <input
              id="instructor-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {loginError && <p className="error-msg">{loginError}</p>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={loginLoading}>
            {loginLoading ? "נכנס..." : "כניסה"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="section container" style={{ maxWidth: "760px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 0.5rem" }}>רשימות מרקידים</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            אפשר לכתוב כל ריקוד בשורה נפרדת, או להדביק טקסט חופשי. אם נוח יותר
            לשלוח קובץ בפורמט אחר, אפשר ליצור איתי קשר ואכניס אותו למערכת.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>
          יציאה
        </button>
      </div>

      <form onSubmit={handleSave}>
        {loadingSubmission && <p style={{ color: "var(--text-muted)" }}>טוען רשימות שמורות...</p>}
        <div className="form-group">
          <label htmlFor="circle-dances">
            ריקודי מעגל ({circleCount}/{MAX_DANCES_PER_LIST})
          </label>
          <textarea
            id="circle-dances"
            value={submission.circleDances}
            onChange={(e) =>
              setSubmission((current) => ({
                ...current,
                circleDances: e.target.value,
              }))
            }
            placeholder={"לדוגמה:\nעוד לא אהבתי די\nערב בא\nהורה מדורה"}
            rows={10}
          />
        </div>

        <div className="form-group">
          <label htmlFor="couple-dances">
            ריקודי זוגות ({coupleCount}/{MAX_DANCES_PER_LIST})
          </label>
          <textarea
            id="couple-dances"
            value={submission.coupleDances}
            onChange={(e) =>
              setSubmission((current) => ({
                ...current,
                coupleDances: e.target.value,
              }))
            }
            placeholder={"לדוגמה:\nשירי לי כנרת\nצליל מיתר\nלילה לילה"}
            rows={10}
          />
        </div>

        <div className="form-group">
          <label htmlFor="instructor-notes">הערות חופשיות</label>
          <textarea
            id="instructor-notes"
            value={submission.notes}
            onChange={(e) =>
              setSubmission((current) => ({
                ...current,
                notes: e.target.value,
              }))
            }
            placeholder="מה מאפיין את ההרקדה? אילו ריקודים חשובים במיוחד? מה כדאי לדעת על הקהל, הרמה, האזור או השעות?"
            rows={6}
          />
        </div>

        {saveError && <p className="error-msg">{saveError}</p>}
        {message && <p className="success-msg">{message}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={saving}>
          {saving ? "שומר..." : "שמירת הרשימות"}
        </button>
      </form>
    </div>
  );
}
