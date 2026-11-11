import {
  type Chart,
  type PlanetId,
  PLANETS,
  PLANET_IDS,
  ROMAN,
  SIGN_RULERS,
  degInSign,
  delta,
  norm,
  signIndex,
} from "@/lib/astro";
import {
  ORB,
  type AspectDef,
  type Antiscion,
  type Course,
  type CurrentAspect,
  type MoonNext,
  antiscionContact,
  aspectGrid,
  course,
  currentAspect,
  lastContact,
  moonNextAspect,
} from "@/lib/aspects";
import { TRIPLICITY, type PlanetState, type Reception, planetState, reception } from "@/lib/dignities";

/**
 * The automatic reading of a horary chart, done the way a traditional
 * astrologer starts one: considerations before judgement, significators and
 * their condition, reception, the main aspect and whether it perfects. It is
 * a summary of the mechanics — the reading from the books comes on top.
 */

const NAMES = Object.fromEntries(PLANET_IDS.map((p) => [p, PLANETS[p].name])) as Record<PlanetId, string>;

export type Level = "ok" | "warn" | "bad";
export type Consideration = { level: Level; title: string; text: string };

export type PlanetRow = {
  id: PlanetId;
  lon: number;
  house: number;
  state: PlanetState;
  statuses: string[];
};

export type Significator = {
  role: string;
  planet: PlanetId;
  subtitle: string;
  row: PlanetRow;
};

/** A third planet that joins the significators when they do not meet. */
export type Helper = {
  kind: "translation" | "collection";
  planet: PlanetId;
  /** Translation: the significator it separates from, then the one it applies to. */
  from: PlanetId;
  to: PlanetId;
  aspect: AspectDef;
  /** The helper stands in the dignities of both significators. */
  received: boolean;
};

export type Verdict = { tone: "yes" | "hard" | "no" | "open"; title: string; text: string };

export type Judgement = {
  chart: Chart;
  house: number;
  moonWaxing: boolean;
  verdict: Verdict;
  radical: boolean;
  considerations: Consideration[];
  significators: Significator[];
  natural: PlanetId | null;
  reception: (Reception & { a: PlanetId; b: PlanetId }) | null;
  main: { now: CurrentAspect | null; course: Course; timing: string | null; a: PlanetId; b: PlanetId } | null;
  moonNext: MoonNext;
  helpers: Helper[];
  antiscia: (Antiscion & { a: PlanetId; b: PlanetId }) | null;
  planets: PlanetRow[];
  grid: { a: PlanetId; b: PlanetId; aspect: AspectDef }[];
};

function statusesOf(id: PlanetId, lon: number, speed: number, sunLon: number): string[] {
  const out: string[] = [];
  if (speed < 0) out.push("R");
  if (id !== "sun") {
    const d = Math.abs(delta(lon, sunLon));
    if (d < 17 / 60) out.push("кацими");
    else if (d < 8.5) out.push("сожжён");
    else if (d < 17) out.push("под лучами");
  }
  return out;
}

/** Lilly's temperaments of the planets. */
const NATURE: Record<PlanetId, string> = {
  sun: "горячие и сухие", mars: "горячие и сухие", jupiter: "горячие и влажные", saturn: "холодные и сухие",
  mercury: "холодные и сухие", venus: "холодные и влажные", moon: "холодные и влажные",
};

const plural = (n: number, forms: [string, string, string]) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
};

const UNITS = {
  days: ["день", "дня", "дней"],
  weeks: ["неделя", "недели", "недель"],
  months: ["месяц", "месяца", "месяцев"],
  years: ["год", "года", "лет"],
} as const;

/**
 * Lilly's timing: degrees to perfection, counted in units chosen by the
 * applying planet's house (angular, succedent, cadent) and sign (cardinal,
 * fixed, mutable).
 */
function timing(distance: number, house: number, lon: number): string {
  const place = house % 3 === 1 ? 0 : house % 3 === 2 ? 1 : 2;
  const quality = signIndex(lon) % 3; // 0 cardinal, 1 fixed, 2 mutable
  const table: (keyof typeof UNITS)[][] = [
    ["days", "months", "weeks"],
    ["weeks", "years", "months"],
    ["months", "years", "years"],
  ];
  const unit = table[place][quality];
  const n = Math.max(1, Math.round(distance));
  return `≈ ${n} ${plural(n, UNITS[unit] as unknown as [string, string, string])}`;
}

export function judge(chart: Chart, house: number, natural: PlanetId | null): Judgement {
  const pos = (id: PlanetId) => chart.planets.find((p) => p.id === id)!;
  const sun = pos("sun");
  const moon = pos("moon");

  const planets: PlanetRow[] = chart.planets.map((p) => ({
    id: p.id,
    lon: p.lon,
    house: p.readHouse,
    state: planetState(p.id, p.lon, chart.isDay),
    statuses: statusesOf(p.id, p.lon, p.speed, sun.lon),
  }));
  const row = (id: PlanetId) => planets.find((p) => p.id === id)!;

  const querent = SIGN_RULERS[signIndex(chart.asc)];
  const quesited = SIGN_RULERS[signIndex(chart.cusps[house - 1])];
  const moonWaxing = norm(moon.lon - sun.lon) < 180;

  const significators: Significator[] = [
    { role: "Вы (кверент)", planet: querent, subtitle: "управитель I дома", row: row(querent) },
    { role: "То, о чём спросили", planet: quesited, subtitle: `управитель ${ROMAN[house - 1]} дома`, row: row(quesited) },
    { role: "Ход дела / Луна", planet: "moon", subtitle: "Луна — со-сигнификатор любого вопроса", row: row("moon") },
  ];

  /* ---------- considerations before judgement ---------- */

  const considerations: Consideration[] = [];
  const ascDeg = degInSign(chart.asc);
  if (ascDeg < 3) {
    considerations.push({ level: "warn", title: "Ранний асцендент", text: "Меньше 3° знака: ситуация ещё не сложилась, вопрос может быть преждевременным." });
  } else if (ascDeg > 27) {
    considerations.push({ level: "warn", title: "Поздний асцендент", text: "Больше 27° знака: дело, вероятно, уже решено, повлиять на исход сложно." });
  }

  const moonNext = moonNextAspect(chart.date);
  if (!moonNext) {
    const exception = [1, 3, 8, 11].includes(signIndex(moon.lon));
    considerations.push({
      level: exception ? "ok" : "warn",
      title: "Луна без курса",
      text: exception
        ? "Луна не сделает точных аспектов до выхода из знака, но она в Тельце, Раке, Стрельце или Рыбах — по Лилли там это ослабляет вердикт меньше."
        : "Луна не сделает ни одного точного аспекта до выхода из знака: традиция читает это как «ничего не произойдёт».",
    });
  }
  if (moon.lon >= 195 && moon.lon <= 225) {
    considerations.push({ level: "warn", title: "Луна в Via Combusta", text: "Между 15° Весов и 15° Скорпиона: обстоятельства неустойчивы, дело может пойти непредсказуемо." });
  }
  const saturn = row("saturn");
  if (saturn.house === 7) {
    considerations.push({ level: "warn", title: "Сатурн в VII доме", text: "Классическое предупреждение астрологу: суждение может оказаться ошибочным." });
  } else if (saturn.house === 1) {
    considerations.push({ level: "warn", title: "Сатурн в I доме", text: "Вопрос может быть задан с тревогой или без надежды; ответ стоит читать осторожно." });
  }

  if (chart.hourRuler) {
    // Lilly (CA p. 121): the lord of the hour and the lord of the ascendant
    // are the same planet, of the same triplicity, or of the same nature.
    const h = chart.hourRuler;
    const why =
      h === querent
        ? "он же управляет асцендентом"
        : TRIPLICITY[signIndex(chart.asc) % 4].includes(h)
          ? "он управляет триплицитностью асцендента"
          : NATURE[h] === NATURE[querent]
            ? `он одной природы с управителем I дома (${NAMES[querent]}): оба ${NATURE[h]}`
            : null;
    considerations.push(
      why
        ? { level: "ok", title: "Тест управителя часа пройден", text: `Управитель часа — ${NAMES[h]}, ${why}. По Лилли карта радикальна: она отражает вопрос.` }
        : { level: "warn", title: "Тест управителя часа не пройден", text: `Управитель часа — ${NAMES[chart.hourRuler]}, управитель I дома — ${NAMES[querent]}. По строгому правилу Лилли вопрос задан не вовремя или сформулирован неточно — не запрет, но повод проверить формулировку.` },
    );
  }

  const q = row(querent);
  if (q.state.peregrine) {
    considerations.push({ level: "warn", title: "Сигнификатор кверента — перегрин", text: `${NAMES[querent]} без эссенциальных достоинств в своём градусе: позиция спрашивающего слабая и неустойчивая.` });
  }
  if (q.statuses.includes("сожжён")) {
    considerations.push({ level: "bad", title: "Сигнификатор кверента сожжён", text: `${NAMES[querent]} слишком близко к Солнцу: спрашивающий не видит ситуацию целиком или бессилен в ней.` });
  }
  const qd = row(quesited);
  if (quesited !== querent) {
    if (qd.state.peregrine) {
      considerations.push({ level: "warn", title: "Сигнификатор квезита — перегрин", text: `${NAMES[quesited]} без эссенциальных достоинств: то, о чём спрашивают, слабо и неустойчиво.` });
    }
    if (qd.statuses.includes("R")) {
      considerations.push({ level: "warn", title: "Сигнификатор квезита ретрограден", text: `${NAMES[quesited]} идёт назад: откат, сомнения, возврат к прошлому — сторона может передумать.` });
    }
    if (qd.statuses.includes("сожжён")) {
      considerations.push({ level: "bad", title: "Сигнификатор квезита сожжён", text: `${NAMES[quesited]} слишком близко к Солнцу: предмет вопроса ослаблен или скрыт.` });
    }
  }
  const radical = considerations.every((c) => c.level === "ok");

  /* ---------- reception and the main aspect ---------- */

  /* ---------- helpers: translation and collection of light ---------- */

  const helpers: Helper[] = [];
  let antiscia: Judgement["antiscia"] = null;
  if (querent !== quesited) {
    const A = pos(querent);
    const B = pos(quesited);
    const inDignitiesOfBoth = (id: PlanetId) => {
      const by = row(id).state.receivedBy.map((r) => r.planet);
      return by.includes(querent) && by.includes(quesited);
    };
    for (const p of chart.planets) {
      if (p.id === querent || p.id === quesited) continue;
      // Translation: a lighter planet separates from one significator and
      // applies to the other, carrying the light between them.
      if (Math.abs(p.speed) > Math.abs(A.speed) && Math.abs(p.speed) > Math.abs(B.speed)) {
        // Which significator it touched last; a passing aspect to a third
        // planet in between does not cancel the translation (as on the reference).
        const last = lastContact(p.id, chart.date, [querent, quesited]);
        for (const [from, to] of [[querent, quesited], [quesited, querent]] as const) {
          if (last?.planet !== from) continue;
          const still = Math.abs(delta(pos(from).lon, p.lon));
          const sep = Math.min(...[0, 60, 90, 120, 180].map((a) => Math.abs(still - a)));
          if (sep > ORB[p.id]) continue;
          const next = course(p.id, to, chart.date, NAMES);
          if (next.perfection && !next.refranation) {
            helpers.push({ kind: "translation", planet: p.id, from, to, aspect: next.perfection.aspect, received: inDignitiesOfBoth(p.id) });
          }
        }
      }
      // Collection: both significators apply to a heavier planet, and — Lilly
      // insists — it receives them both.
      const receivesBoth = row(querent).state.receivedBy.some((r) => r.planet === p.id) &&
        row(quesited).state.receivedBy.some((r) => r.planet === p.id);
      if (receivesBoth && Math.abs(p.speed) < Math.abs(A.speed) && Math.abs(p.speed) < Math.abs(B.speed)) {
        const ca = course(querent, p.id, chart.date, NAMES);
        const cb = course(quesited, p.id, chart.date, NAMES);
        if (ca.perfection && !ca.refranation && cb.perfection && !cb.refranation) {
          helpers.push({ kind: "collection", planet: p.id, from: querent, to: quesited, aspect: ca.perfection.aspect, received: true });
        }
      }
    }
    const an = antiscionContact(A.lon, B.lon);
    if (an) antiscia = { ...an, a: querent, b: quesited };
  }

  let rec: Judgement["reception"] = null;
  let main: Judgement["main"] = null;
  let verdict: Verdict;

  if (querent === quesited) {
    verdict = {
      tone: "open",
      title: "Один управитель на двоих",
      text: `${NAMES[querent]} управляет и вами, и предметом вопроса. В таком случае ответ ищут по Луне: её следующий аспект показывает, куда пойдёт дело.`,
    };
  } else {
    const r = reception(querent, q.lon, quesited, row(quesited).lon, chart.isDay);
    rec = { ...r, a: querent, b: quesited };
    const now = currentAspect(querent, quesited, chart.date);
    const c = course(querent, quesited, chart.date, NAMES);
    let time: string | null = null;
    if (c.perfection && !c.refranation) {
      const pa = pos(querent);
      const pb = pos(quesited);
      const fast = Math.abs(pa.speed) >= Math.abs(pb.speed) ? pa : pb;
      time = timing(c.perfection.distance, fast.readHouse, fast.lon);
    }
    main = { now, course: c, timing: time, a: querent, b: quesited };

    const pair = `${NAMES[querent]} и ${NAMES[quesited]}`;
    // Partile: both in the same degree of their signs — the aspect is
    // exact now, which Lilly reads as done rather than past.
    const partile = !!now && Math.floor(degInSign(q.lon)) === Math.floor(degInSign(row(quesited).lon));
    if (partile && now) {
      const { aspect } = now;
      const strongReception = r.strength === "strong";
      verdict =
        aspect.tone === "good"
          ? { tone: "yes", title: "Скорее «да»", text: `${pair} стоят в точном (партильном) аспекте «${aspect.name}»: стороны уже сошлись, дело складывается без больших трений.` }
          : aspect.tone === "hard"
            ? { tone: strongReception ? "yes" : "hard", title: "«Да», но через трудности", text: `${pair} в точном квадрате: результат есть, но с препятствиями${strongReception ? "; сильный взаимный приём смягчает аспект" : ""}.` }
            : { tone: strongReception ? "hard" : "no", title: "Скорее «нет» — или с сожалением", text: `${pair} в точной оппозиции: стороны встретились, но в противостоянии.` };
    } else if (c.refranation) {
      verdict = {
        tone: "no",
        title: "Скорее «нет» — дело срывается",
        text: `${pair} идут к аспекту, но он не доходит до точного: одна из планет разворачивается раньше. Традиция называет это рефранацией — дело подходит к развязке и срывается.${c.perfection ? " Позже планеты всё же сходятся точно — к теме, возможно, придётся вернуться." : ""}`,
      };
    } else if (c.perfection) {
      const { aspect } = c.perfection;
      const strongReception = r.strength === "strong";
      if (aspect.tone === "good") {
        verdict = { tone: "yes", title: "Скорее «да»", text: `${pair} сходятся в аспекте «${aspect.name}» — дело складывается легко.` };
      } else if (aspect.tone === "hard") {
        verdict = {
          tone: strongReception ? "yes" : "hard",
          title: "«Да», но через трудности",
          text: `${pair} сходятся в квадрате: результат возможен, но с препятствиями и задержками${strongReception ? "; сильный взаимный приём смягчает аспект" : ""}.`,
        };
      } else {
        verdict = {
          tone: strongReception ? "hard" : "no",
          title: strongReception ? "Возможно — но с сожалением" : "Скорее «нет» — или с сожалением",
          text: `${pair} сходятся в оппозиции: стороны встречаются, но в противостоянии, и итог редко радует.`,
        };
      }
    } else if (helpers.length) {
      const h = helpers.find((x) => x.received) ?? helpers[0];
      verdict =
        h.kind === "translation"
          ? {
              tone: "yes",
              title: "«Да», через посредника",
              text: `${pair} не сходятся напрямую, но ${NAMES[h.planet]} переносит свет от планеты ${PLANETS[h.from].gen} к планете ${PLANETS[h.to].gen}: дело может сложиться через третье лицо.${h.received ? " Посредник стоит в достоинствах обеих сторон — по Лилли это доводит дело надёжно." : ""}`,
            }
          : {
              tone: "yes",
              title: "«Да», через третью сторону",
              text: `${pair} не сходятся напрямую, но оба приходят к аспекту с планетой ${PLANETS[h.planet].gen}, и она принимает обоих: она собирает их свет, и дело решается через кого-то более весомого.`,
            };
    } else if (now && !now.applying) {
      verdict = { tone: "no", title: "Момент, похоже, прошёл", text: `${pair} в аспекте «${now.aspect.name}», но он уже расходится: главное событие позади.` };
    } else {
      verdict = {
        tone: "no",
        title: "Скорее «нет» — сигнификаторы не сходятся",
        text: `${pair} не приходят к точному аспекту, пока остаются в своих знаках. Посредника, который перенёс или собрал бы их свет, в карте нет.`,
      };
    }
  }

  // Helpers matter only when the significators do not meet on their own.
  const direct = !!main && (!!main.course.perfection || main.course.refranation || (!!main.now && Math.floor(degInSign(row(main.a).lon)) === Math.floor(degInSign(row(main.b).lon))));
  if (direct) helpers.length = 0;

  return {
    chart,
    house,
    moonWaxing,
    verdict,
    radical,
    considerations,
    significators,
    natural,
    reception: rec,
    main,
    moonNext,
    helpers,
    antiscia,
    planets,
    grid: aspectGrid(chart.date),
  };
}
