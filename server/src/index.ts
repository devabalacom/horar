import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { migrate, pool } from "./db.js";
import { env } from "./env.js";

await migrate();
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: "127.0.0.1" }, (i) =>
  console.log(`horar api on http://127.0.0.1:${i.port}`),
);

const stop = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
