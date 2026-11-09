import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { AREAS } from "./chart.js";
import { chunk } from "./chunk.js";
import { migrate, pool } from "./db.js";

/**
 * Loads a book into the search index:
 *   npm run ingest -- book.docx --title "Христианская астрология" --author "Уильям Лилли" --topics work,money
 * --topics lists the question areas the book speaks to (see AREAS in chart.ts);
 * "general" marks a book that is searched for every question.
 * Supported: .txt .md .docx .pdf .fb2. Running again with the same slug
 * replaces the book's passages.
 */

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" },
    author: { type: "string", default: "" },
    topics: { type: "string", default: "general" },
    slug: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const file = positionals[0];
if (!file || !values.title) {
  console.error('usage: npm run ingest -- <file> --title "Название" [--author "Автор"] [--topics work,money] [--slug slug] [--dry-run]');
  process.exit(2);
}

const topics = values.topics.split(",").map((t) => t.trim()).filter(Boolean);
const unknown = topics.filter((t) => !(AREAS as readonly string[]).includes(t));
if (unknown.length) {
  console.error(`unknown --topics ${unknown.join(", ")}; known: ${AREAS.join(", ")}`);
  process.exit(2);
}

function decodeText(buf: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // Old Russian .txt files are often in cp1251: lots of U+FFFD means it wasn't UTF-8.
  const bad = (utf8.match(/�/g) ?? []).length;
  return bad > utf8.length / 200 ? new TextDecoder("windows-1251").decode(buf) : utf8;
}

async function extract(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  const buf = await readFile(path);
  switch (ext) {
    case ".txt":
    case ".md":
      return decodeText(buf);
    case ".docx": {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer: buf })).value;
    }
    case ".pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: false });
      return (text as string[]).join("\n\n");
    }
    case ".fb2": {
      const xml = decodeText(buf);
      return xml
        .replace(/<binary[\s\S]*?<\/binary>/g, "")
        .replace(/<title>([\s\S]*?)<\/title>/g, (_, t) => `\n\n${t.replace(/<[^>]+>/g, " ").trim().toUpperCase()}\n\n`)
        .replace(/<\/p>/g, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    }
    default:
      throw new Error(`unsupported file type ${ext}`);
  }
}

const slug =
  values.slug ??
  basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

const text = await extract(file);
const chunks = chunk(text);
const chars = chunks.reduce((s, c) => s + c.text.length, 0);
const chapters = new Set(chunks.map((c) => c.chapter)).size;
console.log(`${file}: ${text.length} chars → ${chunks.length} passages (${chars} chars), ${chapters} chapters`);

if (values["dry-run"]) {
  for (const c of chunks.slice(0, 3)) console.log(`\n[${c.chapter}]\n${c.text.slice(0, 400)}…`);
  process.exit(0);
}
if (chunks.length === 0) throw new Error("no text extracted — a scanned PDF needs OCR first");

await migrate();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO books (slug, title, author, topics) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, topics = EXCLUDED.topics
     RETURNING id`,
    [slug, values.title, values.author, topics],
  );
  const bookId = rows[0].id;
  await client.query("DELETE FROM chunks WHERE book_id = $1", [bookId]);
  for (let i = 0; i < chunks.length; i += 200) {
    const part = chunks.slice(i, i + 200);
    await client.query(
      `INSERT INTO chunks (book_id, ord, chapter, text)
       SELECT $1, ord, chapter, text FROM unnest($2::int[], $3::text[], $4::text[]) AS t(ord, chapter, text)`,
      [bookId, part.map((_, j) => i + j), part.map((c) => c.chapter), part.map((c) => c.text)],
    );
  }
  await client.query("COMMIT");
  console.log(`book "${values.title}" (${slug}) [${topics.join(",")}] saved: ${chunks.length} passages`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
