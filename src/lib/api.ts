/**
 * The horar API (server/): readings from the books and Похоже/Мимо votes.
 * NEXT_PUBLIC_API_URL is baked in at build time; without it the page works
 * as before and the reading card says the service is not connected. "/"
 * means the API is served from the same origin as the page.
 */

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const API_ENABLED = RAW_API_URL !== "";
export const API_URL = RAW_API_URL.replace(/\/$/, "");

export type ChartRequest = {
  category: string;
  topic: string;
  house: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  lat: number;
  lng: number;
  tz: string;
  city: string;
  question: string;
};

export type ReadingSource = { n: number; book: string; author: string; chapter: string; quote: string };
export type ReadingSegment = { text: string; sources: number[] };
export type Reading = {
  id: string;
  /** The verdict the books lead to; null when the model ignored the format. */
  verdict: { tone: "yes" | "hard" | "no" | "open"; label: string; title: string } | null;
  /** Short answer for the result block. */
  summary: ReadingSegment[];
  /** Detailed reading. */
  segments: ReadingSegment[];
  sources: ReadingSource[];
  grounded: boolean;
};

const MESSAGES: Record<string, string> = {
  rate_limited: "Слишком много толкований за час. Попробуйте позже.",
  llm_not_configured: "Толкование временно недоступно.",
  refused: "По этой карте толкование составить не получилось.",
};

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(MESSAGES[data.error] ?? "Не удалось получить ответ. Попробуйте ещё раз.");
  return data as T;
}

export const fetchReading = (chart: ChartRequest) => post<Reading>("/api/reading", chart);

export const sendFeedback = (chart: ChartRequest, vote: "up" | "down") =>
  post<{ ok: true }>("/api/feedback", { chart, vote });
