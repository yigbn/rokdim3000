import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
  const FILE_INPUT_ID = "instructor-file-input";
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
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!authenticated) return;

    let ignore = false;
    setLoadingSubmission(true);
    setSaveError("");
    setUploadError("");

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

    instructors
      .getFiles()
      .then((uploadedFiles) => {
        if (!ignore) setFiles(uploadedFiles);
      })
      .catch((err) => {
        if (ignore) return;
        setUploadError(err instanceof Error ? err.message : "לא ניתן לטעון רשימת קבצים");
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
    setSaveMessage("");
    setUploadMessage("");
    setSaveError("");
    setUploadError("");
    setFiles([]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveMessage("");
    setSaveError("");

    if (circleCount > MAX_DANCES_PER_LIST || coupleCount > MAX_DANCES_PER_LIST) {
      setSaveError("אפשר להזין עד 300 ריקודי מעגל ועד 300 ריקודי זוגות");
      return;
    }

    setSaving(true);
    try {
      const saved = await instructors.saveSubmission(submission);
      setSubmission(toSubmissionForm(saved));
      setSaveMessage("הרשימות נשמרו בשרת. אפשר לחזור ולעדכן אותן בהמשך.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function refreshFiles() {
    const uploadedFiles = await instructors.getFiles();
    setFiles(uploadedFiles);
    return uploadedFiles;
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected?.length) return;

    setUploadError("");
    setUploadMessage("מעלה קבצים...");
    setUploading(true);

    const uploaded: InstructorFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(selected)) {
      try {
        uploaded.push(await instructors.uploadFile(file));
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : "שגיאה"}`);
      }
    }

    e.target.value = "";

    try {
      const confirmed = await refreshFiles();
      if (uploaded.length) {
        setUploadMessage(
          uploaded.length === 1
            ? `✓ הקובץ "${uploaded[0].originalName}" עלה בהצלחה (${confirmed.length} קבצים בסך הכל)`
            : `✓ ${uploaded.length} קבצים עלו בהצלחה (${confirmed.length} קבצים בסך הכל)`,
        );
      } else if (!errors.length) {
        setUploadMessage("");
      }
    } catch (err) {
      if (uploaded.length) {
        setFiles((current) => [...uploaded, ...current]);
        setUploadMessage(
          uploaded.length === 1
            ? `✓ הקובץ "${uploaded[0].originalName}" עלה`
            : `✓ ${uploaded.length} קבצים עלו`,
        );
      }
      errors.push(err instanceof Error ? err.message : "לא ניתן לרענן רשימת קבצים");
    }

    if (errors.length) {
      setUploadError(errors.join(" · "));
      if (!uploaded.length) {
        setUploadMessage("");
      }
    }
    setUploading(false);
  }

  function renderFileUploadPanel() {
    return (
      <div className="instructor-panel">
        <h2>העלאת קבצים {files.length > 0 && `(${files.length})`}</h2>
        <p style={{ margin: "0 0 0.65rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          אפשר לעלות כמה קבצים — למשל אחד למעגלים ואחד לזוגות.
        </p>
        <input
          id={FILE_INPUT_ID}
          className="instructor-file-input"
          type="file"
          multiple
          disabled={uploading}
          onChange={handleFilesSelected}
        />
        <label
          htmlFor={FILE_INPUT_ID}
          className={`btn btn-primary instructor-file-label${uploading ? " is-disabled" : ""}`}
        >
          {uploading ? "מעלה..." : "בחירת קבצים להעלאה"}
        </label>
        {uploadMessage && <p className="instructor-upload-success">{uploadMessage}</p>}
        {uploadError && <p className="error-msg" style={{ marginTop: "0.65rem", marginBottom: 0 }}>{uploadError}</p>}
        {files.length > 0 ? (
          <ul className="instructor-file-list">
            {files.map((file) => (
              <li key={file.id}>
                ✓ {file.originalName} ({formatFileSize(file.sizeBytes)}) — {formatUploadDate(file.uploadedAt)}
              </li>
            ))}
          </ul>
        ) : (
          !uploading && <p className="instructor-upload-empty">עדיין לא הועלו קבצים</p>
        )}
      </div>
    );
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
    <div className="section container instructor-page">
      <div className="instructor-page-header">
        <div>
          <h1>רשימות מרקידים</h1>
          <p className="instructor-page-intro">
            אפשר לכתוב כל ריקוד בשורה נפרדת, להדביק טקסט חופשי, או לעלות כמה קבצים.
          </p>
        </div>
        <div className="instructor-page-actions">
          <button type="submit" form="instructor-submission-form" className="btn btn-primary" disabled={saving || loadingSubmission}>
            {saving ? "שומר..." : "שמירת הרשימות"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            יציאה
          </button>
        </div>
      </div>

      {saveError && <p className="error-msg">{saveError}</p>}
      {saveMessage && <p className="success-msg">{saveMessage}</p>}
      {loadingSubmission && <p style={{ color: "var(--text-muted)", marginTop: 0 }}>טוען רשימות שמורות...</p>}

      <div className="instructor-form-grid">
        <form id="instructor-submission-form" onSubmit={handleSave} className="instructor-dances">
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
              rows={5}
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
              rows={5}
            />
          </div>
        </form>

        <aside className="instructor-sidebar">
          <div className="instructor-panel">
            <h2>הערות חופשיות</h2>
            <textarea
              id="instructor-notes"
              form="instructor-submission-form"
              value={submission.notes}
              onChange={(e) =>
                setSubmission((current) => ({
                  ...current,
                  notes: e.target.value,
                }))
              }
              rows={6}
            />
          </div>

          {renderFileUploadPanel()}
        </aside>
      </div>
    </div>
  );
}
