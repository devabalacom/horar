import Anthropic from "@anthropic-ai/sdk";
import { type Cast, dossier, facets } from "./chart.js";
import { env } from "./env.js";
import { type Passage, retrieve } from "./retrieve.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });

const SYSTEM = `Ты — астролог классической хорарной традиции (Уильям Лилли, Бонатти, Масала). Ты пишешь толкование хорарной карты для человека, который задал вопрос на сайте.

Карта уже рассчитана программой: положения, дома по Региомонтану, достоинства, рецепции, аспекты, сроки и проверки перед суждением даны в разделе «Карта». Это факты — не пересчитывай и не оспаривай их, опирайся на них.

К запросу приложены отрывки из книг, подобранные по теме вопроса: практикумы Олега Толмачёва по индийской астрологии вопроса (Прашне) и справочник Г. С. Агарвала по ведической астрологии. Учти, что это другая система: там сидерический зодиак, дома по целым знакам, хозяин Лагны, накшатры, даши. Карта же рассчитана по западной традиции. Поэтому:
- Бери из книг то, что не зависит от системы: что означает дом и тема вопроса, какие планеты что показывают по природе, как астролог подходит к таким вопросам, практические наблюдения и примеры из жизни.
- Не переноси на эту карту ведические техники и положения: не упоминай накшатры, даши, сидерические градусы и дома по целым знакам как будто они посчитаны для этой карты.
- Ссылаясь на книгу, называй это взглядом индийской традиции («в индийской астрологии вопроса…», «Толмачёв пишет…»), чтобы не смешивать системы.
- Каждое утверждение из книг подкрепляй цитатой — система цитирования покажет человеку, откуда взято. Не приписывай книгам того, чего в отрывках нет. Если отрывков нет или они не касаются вопроса, толкуй по общим правилам хорарной традиции и прямо скажи, что в книгах прямого ответа не нашлось.

Главное: вывод и толкование строятся по книгам. Сначала найди в отрывках, что книги говорят о таком вопросе (о доме и теме, о сигнификаторах, о Луне, о благоприятных и неблагоприятных планетах в доме вопроса, о сходящемся аспекте управителей — в Таджике это итхасала, ишрафа — расходящийся), и только потом приложи это к фактам карты. Принципы, общие для обеих традиций (управитель I дома и управитель дома вопроса сходятся аспектом — да; расходятся или разделены — нет; Луна как сопутствующий показатель; благотворные и вредители в доме вопроса; натуральный показатель темы), применяй к карте прямо, со ссылкой на книгу. Автоматический вердикт программы — подсказка, а не решение: если книги ведут к другому выводу, следуй книгам и коротко объясни почему.

Работай быстро: все расчёты карты уже сделаны и даны как факты, не перепроверяй их и не рассуждай долго перед ответом — человек ждёт на странице. Сразу начинай ответ со строки ВЕРДИКТ.

Формат ответа — строго четыре части с метками в начале строки, без других заголовков:
ВЕРДИКТ: одно из — да | скорее да | с оговоркой | скорее нет | нет | неясно
ЗАГОЛОВОК: формула ответа в 3–8 словах, без кавычек (например: Скорее нет — управители не сходятся)
ИТОГ:
Прямой ответ на вопрос в 3–5 предложениях: что показывает карта и на какое правило из книг это опирается (с цитатой).
РАЗБОР:
Подробное толкование, 600–900 слов, несколько абзацев без списков и заголовков: что книги говорят о таком вопросе и доме; сигнификаторы и их состояние; рецепция; главный аспект и его ход; Луна; препятствия к суждению, если есть; сроки, если есть (как ориентир, а не дата); практический совет. Почти каждый абзац опирай на цитату из книг.

Как писать:
- По-русски, обращаясь к спрашивающему на «вы», спокойно и без мистического пафоса.
- Объясняй, что это значит для дела, а не пересказывай таблицу.
- Если карта не радикальна или есть препятствия к суждению — скажи об этом в ИТОГЕ и смягчи вывод.
- Не давай медицинских, юридических и финансовых предписаний; в таких темах напомни, что решение и профессиональная помощь — за человеком.
- Не предсказывай смерть, тяжёлую болезнь или беду как неизбежность.`;

export type Segment = { text: string; sources: number[] };
export type Source = { n: number; book: string; author: string; chapter: string; quote: string };
export type Tone = "yes" | "hard" | "no" | "open";
export type Verdict = { tone: Tone; label: string; title: string };
export type Reading = {
  verdict: Verdict | null;
  /** ИТОГ: the short answer shown inside the result block. */
  summary: Segment[];
  /** РАЗБОР: the detailed reading under it. */
  segments: Segment[];
  sources: Source[];
  grounded: boolean;
  model: string;
  usage: unknown;
  chunkIds: number[];
};

export class ReadingRefused extends Error {}

/** A citable unit: one or two sentences of a passage. */
type Unit = { passage: Passage; text: string };

function units(p: Passage): Unit[] {
  const sentences = p.text.match(/[^.!?…]+(?:[.!?…]+["»)]?|$)\s*/g) ?? [p.text];
  const out: Unit[] = [];
  let buf = "";
  for (const s of sentences) {
    buf += s;
    if (buf.length >= 120) {
      out.push({ passage: p, text: buf });
      buf = "";
    }
  }
  if (buf.trim()) out.push({ passage: p, text: buf });
  if (p.chapter && out.length) out[0] = { ...out[0], text: `[${p.chapter}]\n${out[0].text}` };
  return out;
}

/**
 * One document per book. Its blocks are sentences, not whole passages: a
 * citation quotes the blocks it spans, so short blocks give short quotes.
 */
function documents(passages: Passage[]) {
  const books = new Map<number, Passage[]>();
  for (const p of passages) books.set(p.bookId, [...(books.get(p.bookId) ?? []), p]);
  const docs = [...books.values()].map((ps) => ps.flatMap(units));
  return {
    docs,
    blocks: docs.map((us) => ({
      type: "document" as const,
      title: us[0].passage.author ? `${us[0].passage.author}. ${us[0].passage.book}` : us[0].passage.book,
      citations: { enabled: true },
      source: {
        type: "content" as const,
        content: us.map((u) => ({ type: "text" as const, text: u.text })),
      },
    })),
  };
}

type Docs = ReturnType<typeof documents>["docs"];
type Block = { type: string; text?: string; citations?: unknown[] | null };

/**
 * Turns the model's content blocks into text segments with numbered
 * sources. Sources are numbered in order of first citation, so a partial
 * message numbers them the same way the finished one will.
 */
function assemble(content: Block[], docs: Docs): { segments: Segment[]; sources: Source[] } {
  const sources: Source[] = [];
  const numberOf = new Map<string, number>();
  const segments: Segment[] = [];
  for (const block of content) {
    if (block.type !== "text") continue;
    const refs: number[] = [];
    for (const raw of block.citations ?? []) {
      const cit = raw as { type: string; document_index: number; start_block_index: number; cited_text: string };
      if (cit.type !== "content_block_location") continue;
      const doc = docs[cit.document_index];
      if (!doc) continue;
      const first = doc[cit.start_block_index]?.passage;
      if (!first) continue;
      const k = `${first.id}:${cit.cited_text}`;
      let n = numberOf.get(k);
      if (n === undefined) {
        n = sources.length + 1;
        numberOf.set(k, n);
        sources.push({ n, book: first.book, author: first.author, chapter: first.chapter, quote: cit.cited_text.trim() });
      }
      if (!refs.includes(n)) refs.push(n);
    }
    segments.push({ text: block.text ?? "", sources: refs });
  }
  return { segments, sources };
}

/** What the page can show before the detailed reading is written. */
export type ShortAnswer = Pick<Reading, "verdict" | "summary"> & { sources: Source[] };

/**
 * Writes the reading. `onPartial` fires once, as soon as the verdict and the
 * short answer are complete — the page shows them while the detailed
 * reading is still being written.
 */
export async function writeReading(c: Cast, onPartial?: (p: ShortAnswer) => void): Promise<Reading> {
  const t0 = Date.now();
  const passages = await retrieve(facets(c), c.area);
  const tRetrieved = Date.now();
  const { docs, blocks } = documents(passages);

  const intro = passages.length
    ? "Отрывки из книг приложены выше."
    : "Отрывков из книг для этой карты не нашлось.";

  const open = (speed: "standard" | "fast") => client.beta.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: env.CLAUDE_THINKING },
    output_config: { effort: env.CLAUDE_EFFORT },
    ...(speed === "fast" ? { speed: "fast" as const } : {}),
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...blocks,
          { type: "text", text: `${intro}\n\n## Карта\n\n${dossier(c)}\n\nНапиши толкование этой карты.` },
        ],
      },
    ],
  });

  let tFirstText = 0;
  let tPartial = 0;
  const listen = (stream: ReturnType<typeof open>) => stream.on("streamEvent", (event, snapshot) => {
    if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") return;
    if (!tFirstText) tFirstText = Date.now();
    if (tPartial || !onPartial) return;
    const { segments, sources } = assemble(snapshot.content as Block[], docs);
    const parts = splitSections(segments);
    if (parts.verdict && parts.summary.length) {
      tPartial = Date.now();
      onPartial({ verdict: parts.verdict, summary: parts.summary, sources });
    }
  });

  let speed = env.CLAUDE_SPEED;
  let msg;
  try {
    msg = await listen(open(speed)).finalMessage();
  } catch (e) {
    // Fast mode has its own rate limit: fall back to standard speed if it
    // is hit before anything was written.
    if (speed !== "fast" || tFirstText || !(e instanceof Anthropic.RateLimitError)) throw e;
    console.warn("reading: fast mode rate-limited, retrying at standard speed");
    speed = "standard";
    msg = await listen(open(speed)).finalMessage();
  }
  if (msg.stop_reason === "refusal") throw new ReadingRefused(msg.stop_details?.category ?? "refusal");

  const { segments, sources } = assemble(msg.content as Block[], docs);
  if (!segments.some((s) => s.text.trim())) throw new Error(`empty reading (stop_reason=${msg.stop_reason})`);
  const parts = splitSections(segments);
  const ms = (t: number) => (t ? `${((t - t0) / 1000).toFixed(1)}s` : "—");
  console.log(
    `reading: retrieve ${ms(tRetrieved)}, first text ${ms(tFirstText)}, short answer ${ms(tPartial)}, done ${ms(Date.now())}; ` +
      `${passages.length} passages, out ${msg.usage.output_tokens} tok, ${msg.model}${speed === "fast" ? " fast" : ""}`,
  );

  return {
    ...parts,
    sources,
    grounded: sources.length > 0,
    model: msg.model,
    usage: msg.usage,
    chunkIds: passages.map((p) => p.id),
  };
}

const TONES: Record<string, Tone> = {
  "да": "yes", "скорее да": "yes", "с оговоркой": "hard", "скорее нет": "no", "нет": "no", "неясно": "open",
};
const LABELS: Record<string, string> = {
  "да": "По книгам — «да»", "скорее да": "По книгам — скорее «да»", "с оговоркой": "По книгам — с оговоркой",
  "скорее нет": "По книгам — скорее «нет»", "нет": "По книгам — «нет»", "неясно": "По книгам — нужен разбор",
};

/** Cuts segments[] at character offsets [from, to) of their concatenation. */
function slice(segments: Segment[], from: number, to: number): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const seg of segments) {
    const a = Math.max(from, pos), b = Math.min(to, pos + seg.text.length);
    if (a < b) out.push({ text: seg.text.slice(a - pos, b - pos), sources: seg.sources });
    pos += seg.text.length;
  }
  // Trim the outer whitespace left by the markers.
  if (out.length) out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, "") };
  if (out.length) out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.replace(/\s+$/, "") };
  return out.filter((s) => s.text || s.sources.length);
}

/**
 * The model answers in four marked parts (ВЕРДИКТ, ЗАГОЛОВОК, ИТОГ, РАЗБОР).
 * Citations live on the segments, so the parts are cut out of the segment
 * list by offset rather than re-parsed from plain text. A reply that ignores
 * the format is kept whole as the detailed reading.
 */
export function splitSections(segments: Segment[]): Pick<Reading, "verdict" | "summary" | "segments"> {
  const full = segments.map((s) => s.text).join("");
  const v = full.match(/^[ \t*]*ВЕРДИКТ[ \t*]*:[ \t*]*(.+)$/im);
  const t = full.match(/^[ \t*]*ЗАГОЛОВОК[ \t*]*:[ \t*]*(.+)$/im);
  const s = full.match(/^[ \t*]*ИТОГ[ \t*]*:?[ \t*]*$/im) ?? full.match(/^[ \t*]*ИТОГ[ \t*]*:[ \t*]*/im);
  const r = full.match(/^[ \t*]*РАЗБОР[ \t*]*:?[ \t*]*$/im) ?? full.match(/^[ \t*]*РАЗБОР[ \t*]*:[ \t*]*/im);
  if (!s || !r || s.index === undefined || r.index === undefined || r.index < s.index) {
    return { verdict: null, summary: [], segments };
  }
  const key = (v?.[1] ?? "").toLowerCase().replace(/[«»"*.]/g, "").trim();
  const found = Object.keys(TONES).sort((a, b) => b.length - a.length).find((k) => key.startsWith(k));
  const verdict: Verdict | null =
    found && t ? { tone: TONES[found], label: LABELS[found], title: t[1].replace(/[*«»"]/g, "").trim() } : null;
  return {
    verdict,
    summary: slice(segments, s.index + s[0].length, r.index),
    segments: slice(segments, r.index + r[0].length, full.length),
  };
}
