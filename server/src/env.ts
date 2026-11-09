import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  CLAUDE_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  READINGS_PER_HOUR: z.coerce.number().int().positive().default(6),
  /** Paid (uncached) readings for the whole site per UTC day: a ceiling on the API bill. */
  READINGS_PER_DAY: z.coerce.number().int().positive().default(150),
  IP_SALT: z.string().default("dev-salt"),
  /**
   * Where the visitor's address comes from: "false" — the TCP peer;
   * "true" — the last X-Forwarded-For entry (our own nginx in front);
   * "cloudflare" — CF-Connecting-IP (a Cloudflare tunnel in front, which
   * overwrites that header, so a visitor cannot forge it).
   */
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v) => (v === "cloudflare" ? "cloudflare" : v === "true" || v === "1")),
});

export const env = schema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
