import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

/**
 * Schema migrations, applied in order on startup. Each runs once, inside a
 * transaction; append new entries, never edit applied ones.
 */
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      CREATE TABLE books (
        id         serial PRIMARY KEY,
        slug       text UNIQUE NOT NULL,
        title      text NOT NULL,
        author     text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      -- A passage of a book, a few paragraphs long. The search vector uses the
      -- Russian stemmer, so «рецепция», «рецепции», «рецепцией» all match.
      CREATE TABLE chunks (
        id       serial PRIMARY KEY,
        book_id  int NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        ord      int NOT NULL,
        chapter  text NOT NULL DEFAULT '',
        text     text NOT NULL,
        tsv      tsvector GENERATED ALWAYS AS (
                   setweight(to_tsvector('russian', chapter), 'A') ||
                   setweight(to_tsvector('russian', text), 'B')
                 ) STORED,
        UNIQUE (book_id, ord)
      );
      CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);

      -- One reading per distinct chart + question; the same chart asked twice
      -- is served from here instead of paying for a second model call.
      CREATE TABLE readings (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        chart_key   text UNIQUE NOT NULL,
        request     jsonb NOT NULL,
        answer      text NOT NULL,
        citations   jsonb NOT NULL DEFAULT '[]',
        chunk_ids   int[] NOT NULL DEFAULT '{}',
        model       text NOT NULL,
        usage       jsonb,
        created_at  timestamptz NOT NULL DEFAULT now()
      );

      -- «Похоже» / «Мимо» under a chart. One vote per visitor per chart; a
      -- second click replaces the first.
      CREATE TABLE feedback (
        id         serial PRIMARY KEY,
        chart_key  text NOT NULL,
        reading_id uuid REFERENCES readings(id) ON DELETE SET NULL,
        vote       text NOT NULL CHECK (vote IN ('up', 'down')),
        verdict    text,
        topic      text,
        house      int,
        comment    text,
        ip_hash    text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (chart_key, ip_hash)
      );
    `,
  },
  {
    id: 2,
    sql: `
      -- Which question areas a book speaks to (work, money, health, love, move,
      -- general). Retrieval searches the books of the question's area first.
      ALTER TABLE books ADD COLUMN topics text[] NOT NULL DEFAULT '{}';
    `,
  },
];

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    // Two instances starting at once must not both apply the same migration.
    await client.query("SELECT pg_advisory_lock(714001)");
    const { rows } = await client.query<{ id: number }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
        await client.query("COMMIT");
        console.log(`migration ${m.id} applied`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(714001)").catch(() => {});
    client.release();
  }
}
