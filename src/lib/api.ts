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

/** The verdict and short answer, sent before the detailed reading is written. */
export type ShortAnswer = Pick<Reading, "verdict" | "summary" | "sources">;

/**
 * The reading over server-sent events: `onPartial` gets the verdict and the
 * short answer after a few seconds; the promise resolves with the whole
 * reading. Falls back to the plain endpoint if streaming is unavailable.
 */
export async function streamReading(chart: ChartRequest, onPartial: (p: ShortAnswer) => void): Promise<Reading> {
  const res = await fetch(`${API_URL}/api/reading/stream`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(chart),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(MESSAGES[data.error] ?? "Не удалось получить ответ. Попробуйте ещё раз.");
  }
  if (!res.body) return fetchReading(chart);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "partial") onPartial(JSON.parse(data));
      else if (event === "done") return JSON.parse(data) as Reading;
      else if (event === "error") {
        const e = JSON.parse(data);
        throw new ApiError(MESSAGES[e.error] ?? "Не удалось получить ответ. Попробуйте ещё раз.");
      }
    }
  }
  throw new ApiError("Соединение прервалось. Попробуйте ещё раз.");
}

export const sendFeedback = (chart: ChartRequest, vote: "up" | "down") =>
  post<{ ok: true }>("/api/feedback", { chart, vote });
