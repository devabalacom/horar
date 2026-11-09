import { createHash } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { z } from "zod";
import { cast, chartRequest } from "./chart.js";
import { pool } from "./db.js";
import { corsOrigins, env } from "./env.js";
import { ReadingRefused, writeReading } from "./reading.js";

export const app = new Hono();

app.use("/api/*", cors({ origin: corsOrigins, allowMethods: ["GET", "POST"], maxAge: 86400 }));
app.use("/api/*", bodyLimit({ maxSize: 16 * 1024 }));

function ipHash(c: Context): string {
  let ip = "";
  if (env.TRUST_PROXY === "cloudflare") {
    ip = c.req.header("cf-connecting-ip") ?? "";
  } else if (env.TRUST_PROXY) {
    // Our own nginx appends the real address last; earlier entries are client-supplied.
    const xff = c.req.header("x-forwarded-for");
    ip = xff?.split(",").pop()?.trim() || c.req.header("x-real-ip") || "";
  }
  if (!ip) ip = getConnInfo(c).remote.address ?? "unknown";
  return createHash("sha256").update(env.IP_SALT + ip).digest("hex").slice(0, 32);
}

/** Sliding one-hour window per visitor; only paid (uncached) readings count. */
const spent = new Map<string, number[]>();
let day = "";
let spentToday = 0;

function allowReading(ip: string): boolean {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    spentToday = 0;
  }
  if (spentToday >= env.READINGS_PER_DAY) return false;
  const recent = (spent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= env.READINGS_PER_HOUR) {
    spent.set(ip, recent);
    return false;
  }
  recent.push(now);
  spent.set(ip, recent);
  spentToday++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of spent) if (v.every((t) => now - t >= 3600_000)) spent.delete(k);
}, 600_000).unref();

/** Concurrent requests for one chart share one model call. */
const inFlight = new Map<string, Promise<unknown>>();

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "bad_json" }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "bad_request", issues: parsed.error.issues.slice(0, 5) }, 400);
  return parsed.data;
}

app.get("/api/health", async (c) => {
  const { rows } = await pool.query<{ books: number; chunks: number }>(
    "SELECT (SELECT count(*) FROM books)::int AS books, (SELECT count(*) FROM chunks)::int AS chunks",
  );
  return c.json({ ok: true, ...rows[0], llm: Boolean(env.ANTHROPIC_API_KEY) });
});

app.post("/api/reading", async (c) => {
  const req = await body(c, chartRequest);
  if (req instanceof Response) return req;
  const chart = cast(req);

  const cached = await pool.query("SELECT id, answer, citations FROM readings WHERE chart_key = $1", [chart.key]);
  if (cached.rows[0]) {
    const r = cached.rows[0];
    return c.json({ id: r.id, chartKey: chart.key, cached: true, ...JSON.parse(r.answer), sources: r.citations });
  }

  if (!env.ANTHROPIC_API_KEY) return c.json({ error: "llm_not_configured" }, 503);

  let job = inFlight.get(chart.key) as Promise<{ id: string; payload: object }> | undefined;
  if (!job) {
    if (!allowReading(ipHash(c))) return c.json({ error: "rate_limited" }, 429);
    job = (async () => {
      const r = await writeReading(chart);
      const answer = JSON.stringify({ segments: r.segments, grounded: r.grounded });
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO readings (chart_key, request, answer, citations, chunk_ids, model, usage)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (chart_key) DO UPDATE SET chart_key = EXCLUDED.chart_key
         RETURNING id`,
        [chart.key, chart.req, answer, JSON.stringify(r.sources), r.chunkIds, r.model, JSON.stringify(r.usage)],
      );
      return { id: ins.rows[0].id, payload: { segments: r.segments, grounded: r.grounded, sources: r.sources } };
    })().finally(() => inFlight.delete(chart.key));
    inFlight.set(chart.key, job);
  }

  try {
    const { id, payload } = await job;
    return c.json({ id, chartKey: chart.key, cached: false, ...payload });
  } catch (e) {
    if (e instanceof ReadingRefused) return c.json({ error: "refused" }, 422);
    console.error("reading failed", e);
    return c.json({ error: "reading_failed" }, 502);
  }
});

const feedbackRequest = z
  .object({
    chart: chartRequest,
    vote: z.enum(["up", "down"]),
    comment: z.string().max(1000).optional(),
  })
  .strict();

app.post("/api/feedback", async (c) => {
  const b = await body(c, feedbackRequest);
  if (b instanceof Response) return b;
  const chart = cast(b.chart);
  const reading = await pool.query<{ id: string }>("SELECT id FROM readings WHERE chart_key = $1", [chart.key]);
  await pool.query(
    `INSERT INTO feedback (chart_key, reading_id, vote, verdict, topic, house, comment, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (chart_key, ip_hash) DO UPDATE
       SET vote = EXCLUDED.vote, comment = COALESCE(EXCLUDED.comment, feedback.comment),
           reading_id = COALESCE(EXCLUDED.reading_id, feedback.reading_id), created_at = now()`,
    [
      chart.key,
      reading.rows[0]?.id ?? null,
      b.vote,
      chart.judgement.verdict.tone,
      `${chart.req.category}/${chart.req.topic}`,
      chart.judgement.house,
      b.comment?.trim() || null,
      ipHash(c),
    ],
  );
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal" }, 500);
});
