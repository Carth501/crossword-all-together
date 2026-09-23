/** Thin fetch wrapper: same-origin cookie auth, JSON in/out. */
const BASE = "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (body: { email: string; password: string; display_name: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { username: string; password: string }) => {
    const form = new URLSearchParams();
    form.set("username", body.username);
    form.set("password", body.password);
    return request("/auth/jwt/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  },
  logout: () => request("/auth/jwt/logout", { method: "POST" }),
  me: () => request<{ id: string; email: string; display_name: string }>("/users/me"),
  puzzleToday: () => request("/api/puzzle/today"),
  myLine: () => request("/api/puzzle/today/my-line"),
};
