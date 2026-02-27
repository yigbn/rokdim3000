import { Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth-context";
import Landing from "./Landing";
import Login from "./Login";
import Register from "./Register";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import Profile from "./Profile";
import Dances from "./Dances";

function Nav() {
  const { auth, logout } = useAuth();
  return (
    <nav style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0.75rem 0" }}>
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--text)" }}>
          רוקדים 300
        </Link>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link to="/dances">ריקודים</Link>
          {auth.token ? (
            <>
              <Link to="/profile">הפרופיל שלי</Link>
              <button type="button" className="btn btn-secondary" onClick={logout}>
                יציאה
              </button>
            </>
          ) : (
            <>
              <Link to="/login">התחברות</Link>
              <Link to="/register" className="btn btn-primary">
                הרשמה
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dances" element={<Dances />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
