import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  CLAUDE_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
  /** "fast" = Opus fast mode: up to 2.5x output speed at twice the price. */
  CLAUDE_SPEED: z.enum(["standard", "fast"]).default("fast"),
  /** "between_tools" turns thinking off (Sonnet 5.5 only; Opus 5.5 always thinks). */
  CLAUDE_THINKING: z.enum(["adaptive", "between_tools"]).default("adaptive"),
  PORT: z.coerce.number().int().default(8787),
  /** 0.0.0.0 to take traffic directly; 127.0.0.1 behind a proxy or tunnel. */
  HOST: z.string().default("127.0.0.1"),
  /** The site's static export (../out, built with SELF_HOST=true) to serve beside the API. */
  STATIC_DIR: z.string().optional(),
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
