import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { instructors, type InstructorFile, type InstructorSubmission } from "./api";

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("he-IL");
}

function toSubmissionForm(submission: InstructorSubmission): InstructorSubmissionForm {
  return {
    circleDances: submission.circleDances,
    coupleDances: submission.coupleDances,
    notes: submission.notes,
  };
}

export default function Instructors() {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [files, setFiles] = useState<InstructorFile[]>([]);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!authenticated) return;

    let ignore = false;
    setLoadingSubmission(true);
    setSaveError("");
    setUploadError("");

    Promise.all([instructors.getSubmission(), instructors.getFiles()])
      .then(([data, uploadedFiles]) => {
        if (ignore) return;
        setSubmission(toSubmissionForm(data));
        setFiles(uploadedFiles);
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
    setUploadError("");
    setFiles([]);
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

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError("");
    setMessage("");
    setUploading(true);
    try {
      const uploaded = await instructors.uploadFile(file);
      setFiles((current) => [uploaded, ...current]);
      setMessage(`הקובץ "${uploaded.originalName}" נשמר בשרת.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
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
            אפשר לכתוב כל ריקוד בשורה נפרדת, להדביק טקסט חופשי, או לעלות קובץ
            (Excel, Word, PDF, CSV וכדומה).
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>
          יציאה
        </button>
      </div>

      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          borderRadius: "8px",
          background: "var(--step-bg)",
          border: "1px solid var(--border)",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>העלאת קובץ</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.xls,.xlsx,.doc,.docx,.pdf,.odt,.json"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "מעלה..." : "בחירת קובץ להעלאה"}
        </button>
        {uploadError && <p className="error-msg" style={{ marginTop: "0.75rem" }}>{uploadError}</p>}
        {files.length > 0 && (
          <ul style={{ margin: "0.75rem 0 0", paddingRight: "1.25rem" }}>
            {files.map((file) => (
              <li key={file.id} style={{ marginBottom: "0.35rem" }}>
                {file.originalName} ({formatFileSize(file.sizeBytes)}) — {formatUploadDate(file.uploadedAt)}
              </li>
            ))}
          </ul>
        )}
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
