/**
 * Times one reading end to end without touching the cache:
 *   npx tsx --env-file=.env scripts/time-reading.ts
 * Prints when the short answer and the full reading were ready.
 */
import { cast, chartRequest } from "../src/chart.js";
import { pool } from "../src/db.js";
import { writeReading } from "../src/reading.js";

const req = chartRequest.parse({
  category: "work", topic: "career", house: 10, year: 2026, month: 11, day: 10, hour: 9, minute: 40,
  lat: 59.93863, lng: 30.31413, tz: "Europe/Moscow", city: "Санкт-Петербург", question: "",
});
const t0 = Date.now();
const r = await writeReading(cast(req), (p) =>
  console.log(`short answer at ${((Date.now() - t0) / 1000).toFixed(1)}s: ${p.verdict?.title}`),
);
console.log(`full at ${((Date.now() - t0) / 1000).toFixed(1)}s; verdict ${r.verdict?.title}; ${r.sources.length} sources`);
await pool.end();
