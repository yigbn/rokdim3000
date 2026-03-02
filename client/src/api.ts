const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("rokdim300_token");
}

export async function request<T>(
  path: string,
  options: RequestInit & { body?: object } = {}
): Promise<T> {
  const { body, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((rest.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : rest.body,
  });
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
