/**
 * Splits a book into passages of a few paragraphs, remembering the chapter
 * each one sits in. Passages are what the model cites, so they stay small
 * enough to quote and large enough to carry one rule with its explanation.
 */

const TARGET = 1500;
const MAX = 2400;

const HEADING = /^(глава|часть|раздел|книга|афоризм|chapter|part|section)\b|^[IVXLC]+\.?\s|^§\s*\d/i;

function isHeading(p: string): boolean {
  if (p.length > 90 || /[.,;:]$/.test(p)) return false;
  if (HEADING.test(p)) return true;
  const letters = p.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

export function paragraphs(text: string): string[] {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/­/g, "") // soft hyphens
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2") // words hyphenated across lines
    .replace(/[ \t ]+/g, " ");
  // Books with blank lines between paragraphs split on those; OCR text with
  // one line per row of print is glued back by sentence ends.
  const blocks = /\n\s*\n/.test(clean) ? clean.split(/\n\s*\n/) : clean.split(/(?<=[.!?…»"])\s*\n/);
  return blocks.map((b) => b.replace(/\s*\n\s*/g, " ").trim()).filter((b) => b.length > 0);
}

/**
 * Chart data printed in a book ("As: 26Aq28 Su: 10 Cp 35-GK ...") and the
 * labels of a chart wheel that OCR spills as paragraphs ("Gk", "Rasi", "Md")
 * are a table, not a rule: nothing to search for or quote, so they are left
 * out. Only Latin-script scraps go: a Russian book's prose never looks so.
 */
export function isChartData(p: string): boolean {
  const letters = (p.match(/\p{L}/gu) ?? []).length;
  const cyr = (p.match(/[А-Яа-яЁё]/g) ?? []).length;
  const digits = (p.match(/\d/g) ?? []).length;
  if (letters > 0 && cyr / letters >= 0.5) return false;
  return p.length < 40 || digits / p.length > 0.1;
}

export type Chunk = { chapter: string; text: string };

export function chunk(text: string): Chunk[] {
  const out: Chunk[] = [];
  let chapter = "";
  let buf: string[] = [];
  let len = 0;

  const flush = () => {
    if (buf.length) out.push({ chapter, text: buf.join("\n\n") });
    buf = [];
    len = 0;
  };

  for (const p of paragraphs(text)) {
    if (isChartData(p)) continue;
    if (isHeading(p)) {
      flush();
      chapter = p;
      continue;
    }
    // A single huge paragraph is cut at sentence ends.
    const pieces = p.length > MAX ? (p.match(/[^.!?…]+[.!?…]+["»]?\s*|[^.!?…]+$/g) ?? [p]) : [p];
    for (const piece of pieces) {
      if (len + piece.length > TARGET && len > 0) flush();
      buf.push(piece.trim());
      len += piece.length;
    }
  }
  flush();
  return out.filter((c) => c.text.length >= 80);
}
