// Daily backup of what cannot be rebuilt: readings (paid model calls) and
// feedback votes. Books are re-made from ../books with `npm run ingest`.
// Writes $BACKUP_DIR/horar-YYYY-MM-DD.json.gz and keeps the last 14.
// There is no pg_dump here (embedded-postgres ships only the server), hence JSON.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import pg from "pg";

const dir = process.env.BACKUP_DIR ?? join(process.env.HOME, "horar-data", "backups");
const keep = 14;
mkdirSync(dir, { recursive: true, mode: 0o700 });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dump = {};
for (const t of ["readings", "feedback"]) dump[t] = (await pool.query(`SELECT * FROM ${t} ORDER BY created_at`)).rows;
await pool.end();

const file = join(dir, `horar-${new Date().toISOString().slice(0, 10)}.json.gz`);
writeFileSync(file, gzipSync(JSON.stringify(dump)), { mode: 0o600 });
console.log(`backup ${file}: ${dump.readings.length} readings, ${dump.feedback.length} votes`);

const old = readdirSync(dir).filter((f) => /^horar-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort().slice(0, -keep);
for (const f of old) rmSync(join(dir, f));
