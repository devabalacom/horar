import { serve } from "@hono/node-server";
import { app, loadDailyCount } from "./app.js";
import { migrate, pool } from "./db.js";
import { env } from "./env.js";

await migrate();
await loadDailyCount();
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (i) =>
  console.log(`horar api on http://${env.HOST}:${i.port}${env.STATIC_DIR ? ` (site from ${env.STATIC_DIR})` : ""}`),
);

const stop = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
