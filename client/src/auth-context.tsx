import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth as authApi, users, type UserProfile } from "./api";

interface AuthState {
  token: string | null;
  user: { id: number; email: string; phone: string | null } | null;
  profile: UserProfile | null;
  loading: boolean;
}

const defaultState: AuthState = { token: null, user: null, profile: null, loading: true };

const AuthContext = createContext<{
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(defaultState);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("rokdim300_token");
    if (!token) {
      setAuth((a) => ({ ...a, profile: null, loading: false }));
      return;
    }
    try {
      const profile = await users.getMe();
      setAuth((a) => ({ ...a, profile, loading: false }));
    } catch {
      setAuth((a) => ({ ...a, profile: null, loading: false }));
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("rokdim300_token");
    if (!token) {
      setAuth((a) => ({ ...a, loading: false }));
      return;
    }
    setAuth((a) => ({ ...a, token, user: a.user }));
    users
      .getMe()
      .then((profile) => setAuth((a) => ({ ...a, user: { id: profile.id, email: profile.email, phone: profile.phone }, profile, loading: false })))
      .catch(() => setAuth((a) => ({ ...a, token: null, user: null, profile: null, loading: false })));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    localStorage.setItem("rokdim300_token", token);
    const profile = await users.getMe();
    setAuth({ token, user, profile, loading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, phone?: string) => {
    const { token, user } = await authApi.register(email, password, phone);
    localStorage.setItem("rokdim300_token", token);
    const profile = await users.getMe();
    setAuth({ token, user, profile, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("rokdim300_token");
    setAuth({ token: null, user: null, profile: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
