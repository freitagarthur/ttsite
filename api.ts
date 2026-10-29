export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "tt_token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { loc?: string[]; msg?: string };
      const field = first.loc?.[first.loc.length - 1];
      if (field === "password") return "A senha deve ter pelo menos 8 caracteres.";
      if (field === "email") return "Informe um e-mail válido.";
      if (field === "name") return "Informe seu nome (mínimo 2 caracteres).";
      return first.msg || fallback;
    }
  }
  return fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Tente novamente.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) tokenStore.clear();
    throw new ApiError(extractMessage(data, `Erro inesperado (${res.status}).`), res.status);
  }
  return data as T;
}

// ---------- Tipos ----------
export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface SmaStat {
  current_value: number | null;
  current_distance_pct: number | null;
  mean_distance_pct: number | null;
  max_distance_pct: number | null;
}

export interface Point {
  time: string;
  value: number;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AssetAnalysis {
  id: number;
  descriptive: { asset: string; days: number; start_date: string; end_date: string; last_close: number | null };
  statistics: {
    mean_daily_change_pct: number | null;
    mean_abs_daily_change_pct: number | null;
    max_daily_change_pct: number | null;
    max_daily_gain_pct: number | null;
    max_daily_gain_date: string | null;
    max_daily_loss_pct: number | null;
    max_daily_loss_date: string | null;
    std_daily_change_pct: number | null;
    sma: Record<"9" | "21" | "200", SmaStat | null>;
    gaps: { total: number; up: number; down: number; days_compared: number; frequency_pct: number | null };
    last_high_vs_sma200_pct: number | null;
    last_close_vs_sma200_pct: number | null;
    rsi14: number | null;
    ibov_correlation: { value: number | null; p_value?: number | null; days: number; message: string | null };
  };
  chart: { candles: Candle[]; sma9: Point[]; sma21: Point[]; sma200: Point[]; rsi14: Point[] };
  warnings: string[];
}

// ---------- Formatação ----------
const nf = (d: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${nf(d).format(v)}%`);
export const fmtNum = (v: number | null | undefined, d = 2) => (v == null ? "—" : nf(d).format(v));
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
