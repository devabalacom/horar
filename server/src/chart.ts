import { createHash } from "node:crypto";
import { z } from "zod";
import { PLANETS, ROMAN, castChart, formatPosition, zonedToDate } from "@/lib/astro";
import { describeState, viaList } from "@/lib/dignities";
import { type Judgement, judge } from "@/lib/judgement";
import { HOUSE_MEANINGS, findTopic } from "@/lib/topics";

/**
 * The server never trusts a chart sent by the browser: it gets the same
 * inputs the page has (topic, moment, place) and casts the chart again with
 * the very same code in src/lib. What goes to the model and into the cache
 * key is therefore exactly what the page shows.
 */

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const chartRequest = z
  .object({
    category: z.string().max(40),
    topic: z.string().max(40),
    house: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2100),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    tz: z.string().max(64).refine(validTz, "unknown time zone"),
    city: z.string().max(120).default(""),
    question: z.string().max(600).default(""),
  })
  .strict();

export type ChartRequest = z.infer<typeof chartRequest>;

/**
 * Question areas. Books are tagged with them at ingest; a reading searches
 * the books of its area plus the "general" ones.
 */
export const AREAS = ["general", "work", "money", "health", "love", "move"] as const;
export type Area = (typeof AREAS)[number];

const CATEGORY_AREA: Record<string, Area> = { work: "work", money: "money", love: "love", move: "move" };

/** For a custom question the house decides the area. */
const HOUSE_AREA: Record<number, Area> = {
  1: "general", 2: "money", 3: "move", 4: "move", 5: "love", 6: "health",
  7: "love", 8: "money", 9: "move", 10: "work", 11: "general", 12: "health",
};

export type Cast = {
  req: ChartRequest;
  key: string;
  area: Area;
  judgement: Judgement;
  title: string;
  topicText: string;
};

export function cast(req: ChartRequest): Cast {
  const found = findTopic(req.category, req.topic);
  // A known topic fixes its house; only "custom" lets the asker pick one.
  const house = found ? found.topic.house : req.house;
  const date = zonedToDate(req.year, req.month, req.day, req.hour, req.minute, req.tz);
  const chart = castChart(date, req.lat, req.lng, req.tz);
  const judgement = judge(chart, house, found?.topic.natural ?? null);
  const question = req.question.trim().replace(/\s+/g, " ");

  const key = createHash("sha256")
    .update(
      JSON.stringify([
        found ? `${req.category}/${req.topic}` : `house/${house}`,
        date.toISOString(),
        req.lat.toFixed(2),
        req.lng.toFixed(2),
        question.toLowerCase(),
      ]),
    )
    .digest("hex")
    .slice(0, 32);

  return {
    req: { ...req, house, question },
    key,
    area: (found && CATEGORY_AREA[found.category.id]) || HOUSE_AREA[house],
    judgement,
    title: found ? found.topic.title : `Вопрос к ${ROMAN[house - 1]} дому`,
    topicText: found ? found.topic.text : HOUSE_MEANINGS[house],
  };
}

const name = (p: keyof typeof PLANETS) => PLANETS[p].name;

/** The chart written out for the model: facts only, already computed. */
export function dossier(c: Cast): string {
  const { judgement: j, req } = c;
  const { chart } = j;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: req.tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const local = (d: Date) => fmt.format(d);
  const lines: string[] = [];

  lines.push(`Тема: ${c.title} — ${c.topicText}`);
  lines.push(`Дом квезита: ${ROMAN[j.house - 1]} (${HOUSE_MEANINGS[j.house]})`);
  if (req.question) lines.push(`Вопрос своими словами: «${req.question}»`);
  lines.push(
    `Момент: ${pad(req.day)}.${pad(req.month)}.${req.year} ${pad(req.hour)}:${pad(req.minute)} (${req.tz})${req.city ? `, ${req.city}` : ""}`,
  );
  lines.push(
    `Асцендент ${formatPosition(chart.asc)}, MC ${formatPosition(chart.mc)}; карта ${chart.isDay ? "дневная" : "ночная"}; Луна ${j.moonWaxing ? "растущая" : "убывающая"}${chart.hourRuler ? `; управитель часа — ${name(chart.hourRuler)}` : ""}.`,
  );
  lines.push("");
  lines.push(`Автоматический вердикт: ${j.verdict.title}. ${j.verdict.text}`);
  lines.push(`Карта ${j.radical ? "радикальна" : "с оговорками"}.`);
  for (const k of j.considerations) lines.push(`- Проверка (${k.level}): ${k.title}. ${k.text}`);

  lines.push("");
  lines.push("Сигнификаторы:");
  for (const s of j.significators) {
    const r = s.row;
    lines.push(
      `- ${s.role}: ${name(s.planet)} (${s.subtitle}) — ${formatPosition(r.lon)}, ${ROMAN[r.house - 1]} дом; ` +
        `достоинства: ${describeState(r.state) || "—"}` +
        (r.statuses.length ? `; статус: ${r.statuses.join(", ")}` : "") +
        (r.state.receivedBy.length
          ? `; принимается: ${r.state.receivedBy.map((x) => `${name(x.planet)} (${viaList(x.via)})`).join(", ")}`
          : ""),
    );
  }
  if (j.natural) lines.push(`Натуральный сигнификатор темы: ${name(j.natural)}.`);

  if (j.reception) {
    const r = j.reception;
    const label = { strong: "сильный взаимный", weak: "слабый взаимный", "one-way": "в одну сторону", none: "нет" }[r.strength];
    lines.push(
      `Рецепция ${name(r.a)} — ${name(r.b)}: ${label}` +
        (r.aInB.length ? `; ${name(r.a)} в достоинствах ${PLANETS[r.b].gen} (${viaList(r.aInB)})` : "") +
        (r.bInA.length ? `; ${name(r.b)} в достоинствах ${PLANETS[r.a].gen} (${viaList(r.bInA)})` : "") +
        ".",
    );
  }

  for (const h of j.helpers) {
    lines.push(
      h.kind === "translation"
        ? `Передача света: ${name(h.planet)} отходит от ${PLANETS[h.from].gen} и сходится (${h.aspect.name}) с ${PLANETS[h.to].gen}${h.received ? "; посредник в достоинствах обоих сигнификаторов" : ""}.`
        : `Собирание света: ${name(h.from)} и ${name(h.to)} сходятся с ${PLANETS[h.planet].gen}, который принимает обоих.`,
    );
  }
  if (j.antiscia) {
    lines.push(`${j.antiscia.kind === "antiscion" ? "Антисцион" : "Контр-антисцион"} ${name(j.antiscia.a)} — ${name(j.antiscia.b)}, орбис ${j.antiscia.orb.toFixed(2)}°.`);
  }

  if (j.main) {
    const m = j.main;
    const now = m.now
      ? `${m.now.aspect.name}, орбис ${m.now.orb.toFixed(1)}°, ${m.now.applying ? "сходящийся" : "расходящийся"}`
      : "сейчас вне орбиса";
    lines.push("");
    lines.push(`Главный аспект ${name(m.a)} — ${name(m.b)}: ${now}.`);
    if (m.course.perfection) {
      lines.push(
        `Точный ${m.course.perfection.aspect.name} наступит ${local(m.course.perfection.date)} местного времени (осталось ${m.course.perfection.distance.toFixed(1)}°).`,
      );
    } else {
      lines.push("Точного аспекта до смены знака нет.");
    }
    if (m.course.refranation) lines.push("Рефранация: одна из планет разворачивается до точного аспекта.");
    if (m.timing) lines.push(`Ориентир по срокам: ${m.timing}.`);
    for (const ev of m.course.events) lines.push(`- ${local(ev.date).slice(0, 10)}: ${ev.text}`);
  }

  lines.push("");
  lines.push(
    j.moonNext
      ? `Следующий аспект Луны: ${j.moonNext.aspect.name}, планета — ${name(j.moonNext.planet)}, точный ${local(j.moonNext.date)} местного времени.`
      : "Луна без курса: до выхода из знака точных аспектов не сделает.",
  );

  lines.push("");
  lines.push("Все планеты:");
  for (const p of j.planets) {
    lines.push(
      `- ${name(p.id)}: ${formatPosition(p.lon)}, ${ROMAN[p.house - 1]} дом, ${describeState(p.state) || "—"}${p.statuses.length ? `, ${p.statuses.join(", ")}` : ""}`,
    );
  }
  return lines.join("\n");
}

/** Words of a free text, for an any-of-these-words search. */
function anyWord(text: string): string | null {
  const words = text.toLowerCase().match(/[а-яё]{4,}/g) ?? [];
  return words.length ? [...new Set(words)].slice(0, 12).join(" or ") : null;
}

/**
 * Search facets for the books. The books are Vedic Prashna practicums while
 * the chart is cast the Western way, so the chart's technical terms
 * (peregrine, hour ruler, reception) are not looked up: the books do not use
 * them. The search is about the matter asked — the topic, its house, the
 * asker's own words — and the planets that signify it.
 */
const HOUSE_ORDINALS = ["", "первый", "второй", "третий", "четвёртый", "пятый", "шестой", "седьмой", "восьмой", "девятый", "десятый", "одиннадцатый", "двенадцатый"];

export function facets(c: Cast): string[] {
  const { judgement: j } = c;
  const out = new Set<string>();
  out.add(c.title);
  for (const t of [c.topicText, HOUSE_MEANINGS[j.house], c.req.question]) {
    const q = t && anyWord(t);
    if (q) out.add(q);
  }
  for (const s of j.significators) out.add(name(s.planet));
  if (j.natural) out.add(name(j.natural));
  if (j.main?.timing) out.add("сроки or время or когда");
  // How the Prashna books phrase the rules a horary verdict rests on.
  out.add(`${j.house} дом or ${HOUSE_ORDINALS[j.house]} дом`);
  out.add("итхасала or ишрафа or сходящийся аспект");
  out.add("хозяин лагны or управитель лагны or хозяин дома вопроса");
  out.add("Луна вопрос");
  return [...out].map((s) => s.slice(0, 300));
}
