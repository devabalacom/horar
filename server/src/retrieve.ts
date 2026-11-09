import type { Area } from "./chart.js";
import { pool } from "./db.js";

export type Passage = { id: number; bookId: number; book: string; author: string; chapter: string; text: string };

/** About 12k tokens of book text per reading. */
const CHAR_BUDGET = 40_000;
const PER_FACET = 4;

/**
 * Full-text search over the books, one query per facet. Only the books of
 * the question's area and the "general" ones are searched (all books when
 * the area has none of its own). Passages of the area's own books come
 * first; then a passage found by several facets is the one that speaks to
 * this question most directly, with the text rank as tie-break.
 */
export async function retrieve(facets: string[], area: Area): Promise<Passage[]> {
  if (facets.length === 0) return [];
  const { rows } = await pool.query<{ id: number; hits: number; rank: number }>(
    `WITH own AS (
       SELECT id FROM books WHERE $3 = ANY(topics)
     ),
     scope AS (
       SELECT id, (id IN (SELECT id FROM own)) AS own FROM books
       WHERE NOT EXISTS (SELECT 1 FROM own) OR $3 = ANY(topics) OR 'general' = ANY(topics)
     ),
     q AS (
       SELECT f, websearch_to_tsquery('russian', f) AS tsq FROM unnest($1::text[]) AS f
     ),
     ranked AS (
       SELECT c.id, s.own, ts_rank_cd(c.tsv, q.tsq) AS rank,
              row_number() OVER (PARTITION BY q.f ORDER BY s.own DESC, ts_rank_cd(c.tsv, q.tsq) DESC) AS rn
       FROM q JOIN chunks c ON c.tsv @@ q.tsq JOIN scope s ON s.id = c.book_id
       WHERE numnode(q.tsq) > 0
     )
     SELECT id, count(*)::int AS hits, max(rank)::float AS rank
     FROM ranked WHERE rn <= $2
     GROUP BY id, own
     ORDER BY own DESC, hits DESC, rank DESC
     LIMIT 40`,
    [facets, PER_FACET, area],
  );
  if (rows.length === 0) return [];

  const { rows: texts } = await pool.query<{
    id: number; book_id: number; title: string; author: string; chapter: string; text: string; ord: number;
  }>(
    `SELECT c.id, c.book_id, b.title, b.author, c.chapter, c.text, c.ord
     FROM chunks c JOIN books b ON b.id = c.book_id WHERE c.id = ANY($1::int[])`,
    [rows.map((r) => r.id)],
  );
  const byId = new Map(texts.map((t) => [t.id, t]));

  const picked: (typeof texts)[number][] = [];
  let used = 0;
  for (const r of rows) {
    const t = byId.get(r.id);
    if (!t) continue;
    if (used + t.text.length > CHAR_BUDGET && picked.length > 0) break;
    picked.push(t);
    used += t.text.length;
  }
  // Inside a book, keep the book's own order so neighbouring passages read on.
  picked.sort((a, b) => a.book_id - b.book_id || a.ord - b.ord);
  return picked.map((t) => ({
    id: t.id, bookId: t.book_id, book: t.title, author: t.author, chapter: t.chapter, text: t.text,
  }));
}
