// Local Postgres for the horar API (no root here, so embedded-postgres runs
// a real PostgreSQL as this user). Started by systemd --user: horar-pg.service.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("./data", import.meta.url));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "horar", password: process.env.PG_PASSWORD ?? "horar", port: 54329, persistent: true });
fs.rmSync(`${dir}/postmaster.pid`, { force: true });
await pg.start();
console.log("PG READY");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);
setInterval(() => {}, 1 << 30);
