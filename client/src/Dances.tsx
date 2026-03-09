import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth-context";
import {
  dances as dancesApi,
  danceOpinions,
  danceRatings,
  type Dance,
  type DanceInput,
} from "./api";

const ADMIN_EMAIL = "yben99@gmail.com";

const DANCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "circle", label: "מעגלים" },
  { value: "couple", label: "זוגות" },
  { value: "circles_btb", label: "מעגלים גב-אל-גב" },
  { value: "couple_btb", label: "זוגות גב-אל-גב" },
];

const SLIDER_LABELS: Record<number, string> = {
  1: "הרבה מאוד",
  2: "הרבה",
  3: "בינוני",
  4: "מעט",
  5: "מעט מאוד",
};

function getTypeLabel(type: string): string {
  return DANCE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export default function Dances() {
  const { auth } = useAuth();
  const [list, setList] = useState<Dance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DanceInput>({ name: "", type: "circle" });
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selectedDanceId, setSelectedDanceId] = useState<number | null>(null);
  const [opinionText, setOpinionText] = useState("");
  const [opinionSaving, setOpinionSaving] = useState(false);
  const [ratingKnowledge, setRatingKnowledge] = useState(3);
  const [ratingEnjoyment, setRatingEnjoyment] = useState(3);
  const [ratingSaving, setRatingSaving] = useState(false);

  const isAdmin = auth.profile?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const filteredList = typeFilter ? list.filter((d) => d.type === typeFilter) : list;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / 20));
  const paginatedList = filteredList.slice(page * 20, page * 20 + 20);
  const selectedDance = selectedDanceId ? list.find((d) => d.id === selectedDanceId) : null;

  useEffect(() => setPage(0), [typeFilter]);
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1);
  }, [page, totalPages]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await dancesApi.list();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Load opinion for non-admin logged-in users
  useEffect(() => {
    if (!auth.token || isAdmin) return;
    danceOpinions.get().then((r) => setOpinionText(r.opinionText)).catch(() => {});
  }, [auth.token, isAdmin]);

  // Load rating when selection changes (logged-in users)
  useEffect(() => {
    if (!auth.token || !selectedDanceId) return;
    danceRatings.get(selectedDanceId).then((r) => {
      setRatingKnowledge(r.knowledge ?? 3);
      setRatingEnjoyment(r.enjoyment ?? 3);
    }).catch(() => {
      setRatingKnowledge(3);
      setRatingEnjoyment(3);
    });
  }, [auth.token, selectedDanceId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");
    setMessage("");
    try {
      await dancesApi.create(form);
      setMessage("הריקוד נוסף");
      setForm({ name: "", type: "circle" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בהוספה");
    }
  }

  async function handleUpdate(e: React.FormEvent, id: number) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await dancesApi.update(id, form);
      setMessage("הריקוד עודכן");
      setEditingId(null);
      setForm({ name: "", type: "circle" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בעדכון");
    }
  }

  async function handleDelete(d: Dance) {
    if (!confirm(`למחוק את הריקוד "${d.name}"?`)) return;
    setError("");
    setMessage("");
    try {
      await dancesApi.delete(d.id);
      setMessage("הריקוד נמחק");
      if (selectedDanceId === d.id) setSelectedDanceId(null);
      if (editingId === d.id) setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
    }
  }

  function startEdit(d: Dance) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      type: d.type,
      creator: d.creator ?? undefined,
      yearOfCreation: d.yearOfCreation ?? undefined,
      category: d.category ?? undefined,
      difficultyLevel: d.difficultyLevel ?? undefined,
      youtubeLink: d.youtubeLink ?? undefined,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", type: "circle" });
  }

  async function saveOpinion() {
    if (!auth.token || isAdmin) return;
    setOpinionSaving(true);
    try {
      await danceOpinions.set(opinionText);
      setMessage("דעתכם נשמרה");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setOpinionSaving(false);
    }
  }

  const saveRatingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingValuesRef = useRef({ knowledge: 3, enjoyment: 3, danceId: 0 });
  ratingValuesRef.current = { knowledge: ratingKnowledge, enjoyment: ratingEnjoyment, danceId: selectedDanceId ?? 0 };

  function scheduleRatingSave() {
    if (!auth.token || !selectedDanceId) return;
    if (saveRatingTimeoutRef.current) clearTimeout(saveRatingTimeoutRef.current);
    saveRatingTimeoutRef.current = setTimeout(async () => {
      saveRatingTimeoutRef.current = null;
      const { knowledge, enjoyment, danceId } = ratingValuesRef.current;
      if (!danceId) return;
      setRatingSaving(true);
      try {
        await danceRatings.set(danceId, knowledge, enjoyment);
        setMessage("הדירוג נשמר");
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשמירת הדירוג");
      } finally {
        setRatingSaving(false);
      }
    }, 600);
  }

  function handleRowClick(d: Dance) {
    if (editingId === d.id) return;
    if (auth.token) setSelectedDanceId((prev) => (prev === d.id ? null : d.id));
  }

  return (
    <div className="section container" style={{ maxWidth: 1100 }}>
      <h1 style={{ marginBottom: "1rem" }}>ריקודים</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        רשימת הריקודים. בהמשך נוסיף סינון ודירוג לפי פרמטרים.
      </p>

      {isAdmin && (
        <section style={{ marginBottom: "2rem", padding: "1.25rem", background: "var(--vision-bg)", borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>הוספת ריקוד</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }} className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>שם הריקוד</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="שם"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>סוג</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6 }}
                >
                  {DANCE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary">הוסף</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>יוצר</label>
                <input
                  value={form.creator ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, creator: e.target.value || undefined }))}
                  placeholder="אופציונלי"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>שנת יצירה</label>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.yearOfCreation ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, yearOfCreation: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                  placeholder="אופציונלי"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>קטגוריה</label>
                <input
                  value={form.category ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || undefined }))}
                  placeholder="אופציונלי"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>רמת קושי</label>
                <input
                  value={form.difficultyLevel ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, difficultyLevel: e.target.value || undefined }))}
                  placeholder="אופציונלי"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                <label>קישור יוטיוב</label>
                <input
                  type="url"
                  value={form.youtubeLink ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeLink: e.target.value || undefined }))}
                  placeholder="https://..."
                />
              </div>
            </div>
          </form>
        </section>
      )}

      {!isAdmin && auth.token && (
        <section style={{ marginBottom: "2rem", padding: "1.25rem", background: "var(--step-bg)", borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem" }}>דעתכם על רשימת הריקודים</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "0.75rem", fontSize: "0.95rem" }}>
            מה כדאי שייכנס לרשימה, מה להסיר, וכל הערה אחרת
          </p>
          <textarea
            value={opinionText}
            onChange={(e) => setOpinionText(e.target.value)}
            placeholder="כתבו כאן את דעתכם..."
            style={{ width: "100%", minHeight: 100, padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "inherit", marginBottom: "0.5rem" }}
          />
          <button type="button" className="btn btn-primary" onClick={saveOpinion} disabled={opinionSaving}>
            {opinionSaving ? "שומר..." : "שמירת דעה"}
          </button>
        </section>
      )}

      {error && <p className="error-msg">{error}</p>}
      {message && <p className="success-msg">{message}</p>}

      {/* Type filter */}
      {!loading && list.length > 0 && auth.token && (
        <p style={{ marginBottom: "0.75rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>
          לחצו על שורה כדי לבחור ריקוד ולדרג אותו (כמה אתם יודעים / כמה אוהבים לרקוד) — הדירוג יופיע מתחת לטבלה.
        </p>
      )}

      {!loading && list.length > 0 && (
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <label style={{ fontWeight: 500 }}>סינון לפי סוג:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, minWidth: 180 }}
          >
            <option value="">הכל</option>
            {DANCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && editingId && (
        <section style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "var(--vision-bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>עריכת ריקוד</h2>
          <form onSubmit={(e) => handleUpdate(e, editingId)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", alignItems: "end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>שם</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>סוג</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 6, width: "100%" }}>
                {DANCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>יוצר</label>
              <input value={form.creator ?? ""} onChange={(e) => setForm((f) => ({ ...f, creator: e.target.value || undefined }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>שנה</label>
              <input type="number" min={1900} max={2100} value={form.yearOfCreation ?? ""} onChange={(e) => setForm((f) => ({ ...f, yearOfCreation: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="שנה" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>קטגוריה</label>
              <input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || undefined }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>קושי</label>
              <input value={form.difficultyLevel ?? ""} onChange={(e) => setForm((f) => ({ ...f, difficultyLevel: e.target.value || undefined }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
              <label>קישור יוטיוב</label>
              <input type="url" value={form.youtubeLink ?? ""} onChange={(e) => setForm((f) => ({ ...f, youtubeLink: e.target.value || undefined }))} style={{ width: "100%", maxWidth: 400 }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary">שמור</button>
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>ביטול</button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <p>טוען...</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>שם</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>סוג</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>יוצר</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>שנה</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>קטגוריה</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>קושי</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>יוטיוב</th>
                  {isAdmin && <th style={{ textAlign: "right", padding: "0.5rem", position: "sticky", right: 0, background: "var(--surface)", minWidth: 140, boxShadow: "-4px 0 8px rgba(0,0,0,0.06)" }}>פעולות</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((d) => (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: selectedDanceId === d.id ? "var(--vision-bg)" : undefined,
                      cursor: auth.token && editingId !== d.id ? "pointer" : undefined,
                    }}
                    onClick={() => handleRowClick(d)}
                  >
                    {editingId === d.id ? (
                      <td colSpan={isAdmin ? 8 : 7} style={{ padding: "0.5rem", background: "var(--vision-bg)", fontWeight: 500 }}>
                        עורכים: {form.name} — לחצו "ביטול" או שמרו למטה
                      </td>
                    ) : (
                      <>
                        <td style={{ padding: "0.5rem" }}>{d.name}</td>
                        <td style={{ padding: "0.5rem" }}>{getTypeLabel(d.type)}</td>
                        <td style={{ padding: "0.5rem" }}>{d.creator ?? "—"}</td>
                        <td style={{ padding: "0.5rem" }}>{d.yearOfCreation ?? "—"}</td>
                        <td style={{ padding: "0.5rem" }}>{d.category ?? "—"}</td>
                        <td style={{ padding: "0.5rem" }}>{d.difficultyLevel ?? "—"}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {d.youtubeLink ? (
                            <a href={d.youtubeLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>קישור</a>
                          ) : (
                            "—"
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: "0.5rem", position: "sticky", right: 0, background: selectedDanceId === d.id ? "var(--vision-bg)" : "var(--surface)", minWidth: 140, boxShadow: "-4px 0 8px rgba(0,0,0,0.06)" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "nowrap" }}>
                              <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.9rem" }} onClick={() => startEdit(d)}>
                                עריכה
                              </button>
                              <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.9rem", color: "var(--error, #c00)" }} onClick={() => handleDelete(d)}>
                                מחיקה
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredList.length === 0 && <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>אין ריקודים בסינון זה.</p>}
          </div>

          {filteredList.length > 0 && totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                הקודם
              </button>
              <span style={{ color: "var(--text-muted)" }}>
                עמוד {page + 1} מתוך {totalPages} ({filteredList.length} ריקודים)
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                הבא
              </button>
            </div>
          )}

          {auth.token && selectedDance && (
            <section style={{ marginTop: "2rem", padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>דירוג: {selectedDance.name}</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                בחרו ברמת הידיעה וההנאה (1 = הרבה מאוד, 5 = מעט מאוד). הדירוג נשמר אוטומטית.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 400 }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 500 }}>
                    כמה אני יודע את הריקוד
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={ratingKnowledge}
                    onChange={(e) => { setRatingKnowledge(parseInt(e.target.value, 10)); scheduleRatingSave(); }}
                    style={{ width: "100%", marginBottom: "0.25rem" }}
                  />
                  <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{SLIDER_LABELS[ratingKnowledge]}</span>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 500 }}>
                    כמה אני אוהב לרקוד את הריקוד
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={ratingEnjoyment}
                    onChange={(e) => { setRatingEnjoyment(parseInt(e.target.value, 10)); scheduleRatingSave(); }}
                    style={{ width: "100%", marginBottom: "0.25rem" }}
                  />
                  <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{SLIDER_LABELS[ratingEnjoyment]}</span>
                </div>
              </div>
              {ratingSaving && <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>שומר...</p>}
            </section>
          )}
        </>
      )}

      <p style={{ marginTop: "2rem" }}>
        <Link to="/">חזרה לדף הבית</Link>
      </p>
    </div>
  );
}
