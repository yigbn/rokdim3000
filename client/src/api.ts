const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("rokdim300_token");
}

export async function request<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  const { body, ...rest } = options;
  const headers = new Headers(rest.headers);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const requestInit: RequestInit = {
    ...rest,
    headers,
  };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, requestInit);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export const auth = {
  register: (email: string, password: string, phone?: string) =>
    request<{ token: string; user: { id: number; email: string; phone: string | null } }>("/auth/register", {
      method: "POST",
      body: { email, password, phone },
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string; phone: string | null } }>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  forgotPassword: (email: string) =>
    request<{ message: string; resetLink?: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    }),
};

export interface UserProfile {
  id: number;
  email: string;
  phone: string | null;
  freeText: string | null;
  imagePath: string | null;
  createdAt: number;
  updatedAt: number;
}

export const users = {
  getMe: () => request<UserProfile>("/users/me"),
  updateMe: (data: { phone?: string; freeText?: string }) =>
    request<{ message: string; updatedAt: number }>("/users/me", {
      method: "PUT",
      body: data,
    }),
};

export async function uploadImage(file: File): Promise<{ imagePath: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(API_BASE + "/upload/image", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "שגיאה בהעלאת תמונה");
  return data as { imagePath: string };
}

export function imageUrl(path: string | null): string {
  if (!path) return "";
  return path.startsWith("http") ? path : `/uploads/${path}`;
}

export interface Dance {
  id: number;
  name: string;
  type: string;
  creator: string | null;
  yearOfCreation: number | null;
  category: string | null;
  difficultyLevel: string | null;
  youtubeLink: string | null;
  createdAt: number;
}

export interface DanceInput {
  name: string;
  type: string;
  creator?: string;
  yearOfCreation?: number;
  category?: string;
  difficultyLevel?: string;
  youtubeLink?: string;
}

export const dances = {
  list: () => request<Dance[]>("/dances"),
  create: (data: DanceInput) =>
    request<Dance>("/dances", { method: "POST", body: data }),
  update: (id: number, data: Partial<DanceInput>) =>
    request<Dance>(`/dances/${id}`, { method: "PUT", body: data }),
  delete: (id: number) =>
    request<void>(`/dances/${id}`, { method: "DELETE" }),
};

export const danceOpinions = {
  get: () =>
    request<{ opinionText: string; updatedAt: number | null }>("/dance-opinions"),
  set: (opinionText: string) =>
    request<{ opinionText: string; updatedAt: number }>("/dance-opinions", {
      method: "PUT",
      body: { opinionText },
    }),
};

export interface DanceRating {
  knowledge: number;
  enjoyment: number;
  updatedAt: number | null;
}

export const danceRatings = {
  getAll: () =>
    request<Record<number, { knowledge: number; enjoyment: number; updatedAt: number }>>("/dance-ratings"),
  get: (danceId: number) =>
    request<{ knowledge: number | null; enjoyment: number | null; updatedAt: number | null }>(`/dance-ratings/${danceId}`),
  set: (danceId: number, knowledge: number, enjoyment: number) =>
    request<{ danceId: number; knowledge: number; enjoyment: number; updatedAt: number }>(
      `/dance-ratings/${danceId}`,
      { method: "PUT", body: { knowledge, enjoyment } }
    ),
};

export interface InstructorSubmission {
  circleDances: string;
  coupleDances: string;
  notes: string;
  updatedAt: number | null;
}

const ADMIN_TOKEN_KEY = "rokdim300_admin_token";
const LEGACY_INSTRUCTOR_TOKEN_KEY = "rokdim300_instructor_token";

export function getAdminToken(): string | null {
  let token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    const legacy = localStorage.getItem(LEGACY_INSTRUCTOR_TOKEN_KEY);
    if (legacy) {
      localStorage.setItem(ADMIN_TOKEN_KEY, legacy);
      localStorage.removeItem(LEGACY_INSTRUCTOR_TOKEN_KEY);
      token = legacy;
    }
  }
  return token;
}

export function isAdminTokenLoggedIn(): boolean {
  return Boolean(getAdminToken());
}

function adminHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const admin = {
  login: (email: string, password: string) =>
    request<{ token: string }>("/admin/login", {
      method: "POST",
      body: { email, password },
    }),
  listInstructors: () =>
    request<Array<{
      email: string;
      lastLoginAt: number | null;
      createdAt: number | null;
      updatedAt: number | null;
      hasSubmission: boolean;
      circleDanceCount: number;
      coupleDanceCount: number;
    }>>("/instructors", { headers: adminHeaders() }),
  getInstructor: (email: string) =>
    request<
      InstructorSubmission & {
        email: string;
        createdAt: number | null;
        lastLoginAt: number | null;
        loginCount: number;
      }
    >(`/instructors/${encodeURIComponent(email)}`, { headers: adminHeaders() }),
  getSubmission: () =>
    request<InstructorSubmission>("/instructors/submission", {
      headers: adminHeaders(),
    }),
  saveSubmission: (data: Omit<InstructorSubmission, "updatedAt">) =>
    request<InstructorSubmission>("/instructors/submission", {
      method: "PUT",
      headers: adminHeaders(),
      body: data,
    }),
  getRating: (danceId: number) =>
    request<{ knowledge: number | null; enjoyment: number | null; updatedAt: number | null }>(
      `/instructors/ratings/${danceId}`,
      { headers: adminHeaders() },
    ),
  setRating: (danceId: number, knowledge: number, enjoyment: number) =>
    request<{ danceId: number; knowledge: number; enjoyment: number; updatedAt: number }>(
      `/instructors/ratings/${danceId}`,
      { method: "PUT", headers: adminHeaders(), body: { knowledge, enjoyment } },
    ),
};

/** @deprecated use admin */
export const instructors = admin;
/** @deprecated use isAdminTokenLoggedIn */
export const isInstructorLoggedIn = isAdminTokenLoggedIn;
