import { storage } from "@/src/utils/storage";

const BASE = "https://victory-pay-tflj.onrender.com/api";
export const TOKEN_KEY = "vp_session_token";

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T = any>(
  path: string,
  opts: { method?: Method; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.secureGet(TOKEN_KEY, "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || "Something went wrong";
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T = any>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T = any>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "PUT", body, auth }),
  del: <T = any>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
};
