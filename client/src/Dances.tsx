import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth-context";
import {
  dances as dancesApi,
  danceOpinions,
  danceRatings,
  instructors as instructorsApi,
  isInstructorLoggedIn,
  type Dance,
  type DanceInput,
} from "./api";

const ADMIN_EMAIL = "yben99@gmail.com";

const DANCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "circle", label: "מעגלים" },
  { value: "couple", label: "זוגות" },
  { value: "circles_btb", label: "מעגלים נוספים" },
  { value: "couple_btb", label: "זוגות נוספים" },
];

const SLIDER_LABELS: Record<number, string> = {
  1: "מעט מאוד",
  2: "מעט",
  3: "בינוני",
  4: "הרבה",
  5: "הרבה מאוד",
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
  const [nameFilter, setNameFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("");
  const [selectedDanceId, setSelectedDanceId] = useState<number | null>(null);
  const [opinionText, setOpinionText] = useState("");
  const [opinionSaving, setOpinionSaving] = useState(false);
  const [ratingKnowledge, setRatingKnowledge] = useState(3);
  const [ratingEnjoyment, setRatingEnjoyment] = useState(3);
  const [ratingSaving, setRatingSaving] = useState(false);

  const isAdmin = auth.profile?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const instructorLoggedIn = isInstructorLoggedIn();
  const canRate = Boolean(auth.token || instructorLoggedIn);
  const useInstructorRatings = instructorLoggedIn;
  const filteredList = list.filter((d) => {
    if (typeFilter && d.type !== typeFilter) return false;
    if (nameFilter && !d.name.startsWith(nameFilter)) return false;
    if (creatorFilter && !(d.creator ?? "").startsWith(creatorFilter)) return false;
    return true;
  });
  const PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / PER_PAGE));
  const paginatedList = filteredList.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const selectedDance = selectedDanceId ? list.find((d) => d.id === selectedDanceId) : null;

  useEffect(() => setPage(0), [typeFilter, nameFilter, creatorFilter]);
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

  // Load rating when selection changes (logged-in users or instructors)
  useEffect(() => {
    if (!canRate || !selectedDanceId) return;
    const loadRating = useInstructorRatings
      ? instructorsApi.getRating(selectedDanceId)
      : danceRatings.get(selectedDanceId);
    loadRating.then((r) => {
      setRatingKnowledge(r.knowledge ?? 3);
      setRatingEnjoyment(r.enjoyment ?? 3);
    }).catch(() => {
      setRatingKnowledge(3);
      setRatingEnjoyment(3);
    });
  }, [canRate, useInstructorRatings, selectedDanceId]);

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

  function scheduleRatingSave(knowledge: number, enjoyment: number) {
    if (!canRate || !selectedDanceId) return;
    const danceId = selectedDanceId;
    const saveAsInstructor = useInstructorRatings;
    if (saveRatingTimeoutRef.current) clearTimeout(saveRatingTimeoutRef.current);
    saveRatingTimeoutRef.current = setTimeout(async () => {
      saveRatingTimeoutRef.current = null;
      setRatingSaving(true);
      try {
        if (saveAsInstructor) {
          await instructorsApi.setRating(danceId, knowledge, enjoyment);
        } else {
          await danceRatings.set(danceId, knowledge, enjoyment);
        }
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
    if (canRate) setSelectedDanceId((prev) => (prev === d.id ? null : d.id));
  }

  function goToPage() {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
      setPage(n - 1);
      setPageInput("");
    }
  }

  function renderRatingPanel() {
    if (!canRate) {
      return (
        <aside className="dances-rating-panel">
          <p className="dances-rating-panel-hint" style={{ margin: 0 }}>
            כדי לבחור ריקוד ולדרג — התחברו כרוקדים או כמרקידים.
          </p>
          <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem" }}>
            מרקידים: <Link to="/instructors">כניסת מרקידים</Link>
          </p>
        </aside>
      );
    }

    if (!selectedDance) {
      return (
        <aside className="dances-rating-panel dances-rating-panel-empty">
          <p className="dances-rating-panel-hint">לחצו על שורה כדי לבחור ריקוד ולדרג אותו</p>
          <span className="dances-rating-arrow" aria-hidden>←</span>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
            כמה אתם יודעים / כמה אוהבים לרקוד — הדירוג יופיע כאן
            {useInstructorRatings && !auth.token && ", כך יחוו גם הרוקדים את הדף"}
          </p>
        </aside>
      );
    }

    return (
      <aside className="dances-rating-panel">
        <h3>דירוג: {selectedDance.name}</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 0.75rem" }}>
          1 = מעט מאוד, 5 = הרבה מאוד. נשמר אוטומטית.
        </p>
        <div className="dances-rating-sliders">
          <div>
            <label htmlFor="rating-knowledge">כמה אני יודע את הריקוד</label>
            <input
              id="rating-knowledge"
              type="range"
              min={1}
              max={5}
              step={1}
              list="dance-rating-ticks"
              value={ratingKnowledge}
              onChange={(e) => {
                const knowledge = parseInt(e.target.value, 10);
                setRatingKnowledge(knowledge);
                scheduleRatingSave(knowledge, ratingEnjoyment);
              }}
              style={{ width: "100%", direction: "rtl" }}
            />
            <div className="slider-hint">
              <span>1 (מעט מאוד)</span>
              <span>5 (הרבה מאוד)</span>
            </div>
            <span className="slider-value">{SLIDER_LABELS[ratingKnowledge]}</span>
          </div>
          <div>
            <label htmlFor="rating-enjoyment">כמה אני אוהב לרקוד את הריקוד</label>
            <input
              id="rating-enjoyment"
              type="range"
              min={1}
              max={5}
              step={1}
              list="dance-rating-ticks"
              value={ratingEnjoyment}
              onChange={(e) => {
                const enjoyment = parseInt(e.target.value, 10);
                setRatingEnjoyment(enjoyment);
                scheduleRatingSave(ratingKnowledge, enjoyment);
              }}
              style={{ width: "100%", direction: "rtl" }}
            />
            <div className="slider-hint">
              <span>1 (מעט מאוד)</span>
              <span>5 (הרבה מאוד)</span>
            </div>
            <span className="slider-value">{SLIDER_LABELS[ratingEnjoyment]}</span>
          </div>
        </div>
        <datalist id="dance-rating-ticks">
          <option value="1" />
          <option value="2" />
          <option value="3" />
          <option value="4" />
          <option value="5" />
        </datalist>
        {ratingSaving && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>שומר...</p>
        )}
      </aside>
    );
  }

  return (
    <div className="section container dances-page" style={{ maxWidth: 1100 }}>
      <h1>ריקודים</h1>
      <p className="dances-page-intro">רשימת הריקודים. בהמשך נוסיף סינון ודירוג לפי פרמטרים.</p>

      {isAdmin && (
        <section className="dances-compact-section" style={{ background: "var(--vision-bg)" }}>
          <h2 style={{ margin: "0 0 0.65rem", fontSize: "1rem" }}>הוספת ריקוד</h2>
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
        <section className="dances-compact-section" style={{ background: "var(--step-bg)" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>דעתכם על רשימת הריקודים</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
            מה כדאי שייכנס לרשימה, מה להסיר, וכל הערה אחרת
          </p>
          <textarea
            value={opinionText}
            onChange={(e) => setOpinionText(e.target.value)}
            placeholder="כתבו כאן את דעתכם..."
            style={{ width: "100%", minHeight: 72, padding: "0.45rem 0.65rem", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "inherit", marginBottom: "0.5rem", fontSize: "0.88rem" }}
          />
          <button type="button" className="btn btn-primary" style={{ padding: "0.45rem 0.9rem", fontSize: "0.88rem" }} onClick={saveOpinion} disabled={opinionSaving}>
            {opinionSaving ? "שומר..." : "שמירת דעה"}
          </button>
        </section>
      )}

      {error && <p className="error-msg">{error}</p>}
      {message && <p className="success-msg">{message}</p>}

      {!loading && list.length > 0 && canRate && (
        <div className="dances-select-banner">
          לחצו על שורה כדי לבחור ריקוד ולדרג אותו — הדירוג מופיע בפאנל משמאל
          {useInstructorRatings && !auth.token && " (כך יחוו גם הרוקדים את הדף)"}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="dances-filters">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <label htmlFor="dance-type-filter">סוג:</label>
            <select
              id="dance-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="">הכל</option>
              {DANCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <label htmlFor="dance-name-filter">שם:</label>
            <input
              id="dance-name-filter"
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="תחילת שם..."
              style={{ minWidth: 100 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <label htmlFor="dance-creator-filter">יוצר:</label>
            <input
              id="dance-creator-filter"
              type="text"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              placeholder="תחילת יוצר..."
              style={{ minWidth: 100 }}
            />
          </div>
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
        <div className="dances-main-grid">
          <div>
            <div className="dances-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>סוג</th>
                    <th>יוצר</th>
                    <th>שנה</th>
                    <th>קטגוריה</th>
                    <th>קושי</th>
                    <th>יוטיוב</th>
                    {isAdmin && (
                      <th style={{ position: "sticky", right: 0, background: "var(--surface)", minWidth: 120, boxShadow: "-4px 0 8px rgba(0,0,0,0.06)" }}>
                        פעולות
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        background: selectedDanceId === d.id ? "var(--vision-bg)" : undefined,
                        cursor: canRate && editingId !== d.id ? "pointer" : undefined,
                      }}
                      onClick={() => handleRowClick(d)}
                    >
                      {editingId === d.id ? (
                        <td colSpan={isAdmin ? 8 : 7} style={{ background: "var(--vision-bg)", fontWeight: 500 }}>
                          עורכים: {form.name} — לחצו "ביטול" או שמרו למטה
                        </td>
                      ) : (
                        <>
                          <td>{d.name}</td>
                          <td>{getTypeLabel(d.type)}</td>
                          <td>{d.creator ?? "—"}</td>
                          <td>{d.yearOfCreation ?? "—"}</td>
                          <td>{d.category ?? "—"}</td>
                          <td>{d.difficultyLevel ?? "—"}</td>
                          <td>
                            {d.youtubeLink ? (
                              <a href={d.youtubeLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>קישור</a>
                            ) : (
                              "—"
                            )}
                          </td>
                          {isAdmin && (
                            <td
                              style={{
                                position: "sticky",
                                right: 0,
                                background: selectedDanceId === d.id ? "var(--vision-bg)" : "var(--surface)",
                                minWidth: 120,
                                boxShadow: "-4px 0 8px rgba(0,0,0,0.06)",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "nowrap" }}>
                                <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }} onClick={() => startEdit(d)}>
                                  עריכה
                                </button>
                                <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem", color: "var(--error, #c00)" }} onClick={() => handleDelete(d)}>
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
              {filteredList.length === 0 && <p style={{ color: "var(--text-muted)", marginTop: "0.65rem", fontSize: "0.88rem" }}>אין ריקודים בסינון זה.</p>}
            </div>

            {filteredList.length > 0 && (
              <div className="dances-pagination">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
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
                  style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  הבא
                </button>
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <label htmlFor="dance-page-input" style={{ fontWeight: 600 }}>עמוד:</label>
                    <input
                      id="dance-page-input"
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), goToPage())}
                      placeholder={String(page + 1)}
                      style={{ width: 48, padding: "0.25rem 0.4rem", border: "1px solid var(--border)", borderRadius: 6, textAlign: "center", fontSize: "0.82rem" }}
                    />
                    <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }} onClick={goToPage}>
                      עבור
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {list.length > 0 && renderRatingPanel()}
        </div>
      )}

      <p style={{ marginTop: "1.25rem", fontSize: "0.88rem" }}>
        <Link to="/">חזרה לדף הבית</Link>
      </p>
    </div>
  );
}
