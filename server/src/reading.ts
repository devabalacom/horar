import Anthropic from "@anthropic-ai/sdk";
import { type Cast, dossier, facets } from "./chart.js";
import { env } from "./env.js";
import { type Passage, retrieve } from "./retrieve.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });

const SYSTEM = `Ты — астролог классической хорарной традиции (Уильям Лилли, Бонатти, Масала). Ты пишешь толкование хорарной карты для человека, который задал вопрос на сайте.

Карта уже рассчитана программой: положения, дома по Региомонтану, достоинства, рецепции, аспекты, сроки и проверки перед суждением даны в разделе «Карта». Это факты — не пересчитывай и не оспаривай их, опирайся на них.

К запросу приложены отрывки из классических книг по хорару. Каждое правило, на которое ты опираешься, по возможности подкрепляй этими отрывками — система цитирования покажет человеку, откуда взято. Не приписывай книгам того, чего в отрывках нет. Если отрывков нет или они не касаются этой карты, толкуй по общим правилам традиции и прямо скажи, что в загруженных книгах прямого ответа не нашлось.

Как писать:
- По-русски, обращаясь к спрашивающему на «вы», спокойно и без мистического пафоса.
- Начни с прямого ответа в одном-двух предложениях: что показывает карта по вопросу.
- Затем разбор: сигнификаторы и их состояние, рецепция, главный аспект и его ход, Луна. Объясняй, что это значит для дела, а не пересказывай таблицу.
- Если в карте есть сроки — скажи, как их читать, и что это ориентир, а не дата.
- Если карта не радикальна или есть препятствия к суждению — скажи об этом в начале и смягчи вывод.
- 250–450 слов, несколько абзацев, без маркированных списков и без заголовков.
- Не давай медицинских, юридических и финансовых предписаний; в таких темах напомни, что решение и профессиональная помощь — за человеком.
- Не предсказывай смерть, тяжёлую болезнь или беду как неизбежность.`;

export type Segment = { text: string; sources: number[] };
export type Source = { n: number; book: string; author: string; chapter: string; quote: string };
export type Reading = {
  segments: Segment[];
  sources: Source[];
  grounded: boolean;
  model: string;
  usage: unknown;
  chunkIds: number[];
};

export class ReadingRefused extends Error {}

function documents(passages: Passage[]) {
  // One document per book; each passage is a block the model can cite.
  const books = new Map<number, Passage[]>();
  for (const p of passages) books.set(p.bookId, [...(books.get(p.bookId) ?? []), p]);
  const docs = [...books.values()];
  return {
    docs,
    blocks: docs.map((ps) => ({
      type: "document" as const,
      title: ps[0].author ? `${ps[0].author}. ${ps[0].book}` : ps[0].book,
      citations: { enabled: true },
      source: {
        type: "content" as const,
        content: ps.map((p) => ({ type: "text" as const, text: p.chapter ? `[${p.chapter}]\n${p.text}` : p.text })),
      },
    })),
  };
}

export async function writeReading(c: Cast): Promise<Reading> {
  const passages = await retrieve(facets(c));
  const { docs, blocks } = documents(passages);

  const intro = passages.length
    ? "Отрывки из книг приложены выше."
    : "Отрывков из книг для этой карты не нашлось.";

  const stream = client.beta.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: env.CLAUDE_EFFORT },
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
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new ReadingRefused(msg.stop_details?.category ?? "refusal");

  // Number sources in order of first citation; the same passage keeps its number.
  const sources: Source[] = [];
  const numberOf = new Map<string, number>();
  const segments: Segment[] = [];
  for (const block of msg.content) {
    if (block.type !== "text") continue;
    const refs: number[] = [];
    for (const cit of block.citations ?? []) {
      if (cit.type !== "content_block_location") continue;
      const doc = docs[cit.document_index];
      if (!doc) continue;
      const first = doc[cit.start_block_index];
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
    segments.push({ text: block.text, sources: refs });
  }

  if (!segments.some((s) => s.text.trim())) throw new Error(`empty reading (stop_reason=${msg.stop_reason})`);

  return {
    segments,
    sources,
    grounded: sources.length > 0,
    model: msg.model,
    usage: msg.usage,
    chunkIds: passages.map((p) => p.id),
  };
}
