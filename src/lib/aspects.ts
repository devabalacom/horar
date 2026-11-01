import { type PlanetId, PLANET_IDS, delta, longitude, norm, signIndex } from "@/lib/astro";

/**
 * Aspects between moving planets: which one is in orb now, whether it is
 * applying, and — by walking the ephemeris forward — whether it actually
 * perfects or one of the planets turns back first (refranation).
 */

export const ASPECTS = [
  { angle: 0, name: "соединение", tone: "good" },
  { angle: 60, name: "секстиль", tone: "good" },
  { angle: 90, name: "квадрат", tone: "hard" },
  { angle: 120, name: "трин", tone: "good" },
  { angle: 180, name: "оппозиция", tone: "bad" },
] as const;

export type AspectDef = (typeof ASPECTS)[number];

/** Lilly's moieties: half of each planet's orb. */
const MOIETY: Record<PlanetId, number> = {
  sun: 7.5, moon: 6, mercury: 3.5, venus: 3.5, mars: 3.75, jupiter: 4.5, saturn: 4.5,
};

const DAY = 86_400_000;

/** How far a pair is from an exact aspect, signed. Elongation is a→b. */
function offset(a: PlanetId, b: PlanetId, date: Date, target: number): number {
  return offsetOf(longitude(a, date), longitude(b, date), target);
}

function offsetOf(lonA: number, lonB: number, target: number): number {
  return delta(target, norm(lonB - lonA));
}

/** Both sides of the elongation: 90° and 270° are both a square. */
function targetsFor(aspect: AspectDef): number[] {
  return aspect.angle === 0 || aspect.angle === 180 ? [aspect.angle] : [aspect.angle, 360 - aspect.angle];
}

export type CurrentAspect = {
  aspect: AspectDef;
  target: number;
  orb: number;
  applying: boolean;
};

export function currentAspect(a: PlanetId, b: PlanetId, date: Date): CurrentAspect | null {
  const limit = MOIETY[a] + MOIETY[b];
  const later = new Date(date.getTime() + 3600_000);
  let best: CurrentAspect | null = null;
  for (const aspect of ASPECTS) {
    for (const target of targetsFor(aspect)) {
      const orb = Math.abs(offset(a, b, date, target));
      if (orb <= limit && (!best || orb < best.orb)) {
        const applying = Math.abs(offset(a, b, later, target)) < orb;
        best = { aspect, target, orb, applying };
      }
    }
  }
  return best;
}

export type SkyEvent = { date: Date; text: string; tone: "neutral" | "good" | "bad" };

export type Perfection = {
  aspect: AspectDef;
  date: Date;
  /** Degrees still to go at the moment of the question. */
  distance: number;
};

export type Course = {
  perfection: Perfection | null;
  /** The aspect in orb was applying but one of the pair turned back first. */
  refranation: boolean;
  events: SkyEvent[];
};

/**
 * Walks forward until the pair perfects an aspect, or one of them leaves its
 * sign, or a year and a half runs out — noting the stations on the way.
 */
export function course(a: PlanetId, b: PlanetId, date: Date, names: Record<PlanetId, string>): Course {
  const involvesMoon = a === "moon" || b === "moon";
  const step = involvesMoon ? 3600_000 : DAY / 4;
  const horizon = date.getTime() + (involvesMoon ? 3 : 540) * DAY;
  const signA = signIndex(longitude(a, date));
  const signB = signIndex(longitude(b, date));
  const now = currentAspect(a, b, date);

  const targets = ASPECTS.flatMap((aspect) => targetsFor(aspect).map((target) => ({ aspect, target })));
  let la = longitude(a, date);
  let lb = longitude(b, date);
  let prev = targets.map(({ target }) => offsetOf(la, lb, target));
  // Direction of travel, read off the step itself rather than asked for.
  let dirA = 0;
  let dirB = 0;
  let stationed = false;
  const events: SkyEvent[] = [];

  for (let t = date.getTime() + step; t <= horizon; t += step) {
    const d = new Date(t);
    const na = longitude(a, d);
    const nb = longitude(b, d);
    const moves = [
      { id: a, dir: Math.sign(delta(la, na)), was: dirA },
      { id: b, dir: Math.sign(delta(lb, nb)), was: dirB },
    ];
    for (const m of moves) {
      if (m.was !== 0 && m.dir !== 0 && m.dir !== m.was) {
        stationed = true;
        events.push({
          date: d,
          text: `${names[m.id]} ${m.dir < 0 ? "разворачивается и идёт назад" : "становится директным"}`,
          tone: "neutral",
        });
      }
    }
    dirA = moves[0].dir || dirA;
    dirB = moves[1].dir || dirB;
    la = na;
    lb = nb;

    const cur = targets.map(({ target }) => offsetOf(la, lb, target));
    for (let i = 0; i < targets.length; i++) {
      // A sign change near zero is a perfection; one near ±180 is just the
      // offset wrapping round.
      if (Math.sign(cur[i]) !== Math.sign(prev[i]) && Math.abs(cur[i]) < 20 && Math.abs(prev[i]) < 20) {
        const { aspect, target } = targets[i];
        const distance = Math.abs(offset(a, b, date, target));
        // Lilly: if either one stations before the aspect is exact, it is
        // refranation, even should they meet again later.
        const refranation = !!now && now.applying && (now.target !== target || stationed);
        events.push({ date: d, text: `точный ${aspect.name}`, tone: aspect.tone === "good" ? "good" : "bad" });
        return { perfection: { aspect, date: d, distance }, refranation, events };
      }
    }
    prev = cur;

    if (signIndex(la) !== signA || signIndex(lb) !== signB) {
      events.push({ date: d, text: "один из сигнификаторов уходит в другой знак", tone: "neutral" });
      break;
    }
  }
  return { perfection: null, refranation: !!now && now.applying, events };
}

export type MoonNext = { planet: PlanetId; aspect: AspectDef; date: Date } | null;

/** The Moon's next exact aspect before she leaves her sign; null is void of course. */
export function moonNextAspect(date: Date): MoonNext {
  const sign = signIndex(longitude("moon", date));
  const others = PLANET_IDS.filter((p) => p !== "moon");
  const targets = others.flatMap((planet) =>
    ASPECTS.flatMap((aspect) => targetsFor(aspect).map((target) => ({ planet, aspect, target }))),
  );
  const lons = (d: Date) => Object.fromEntries(PLANET_IDS.map((p) => [p, longitude(p, d)])) as Record<PlanetId, number>;
  let l = lons(date);
  let prev = targets.map(({ planet, target }) => offsetOf(l[planet], l.moon, target));
  const step = 1800_000;
  for (let t = date.getTime() + step; t < date.getTime() + 3 * DAY; t += step) {
    const d = new Date(t);
    l = lons(d);
    if (signIndex(l.moon) !== sign) return null;
    const cur = targets.map(({ planet, target }) => offsetOf(l[planet], l.moon, target));
    for (let i = 0; i < targets.length; i++) {
      if (Math.sign(cur[i]) !== Math.sign(prev[i]) && Math.abs(cur[i]) < 20) {
        return { planet: targets[i].planet, aspect: targets[i].aspect, date: d };
      }
    }
    prev = cur;
  }
  return null;
}

/** All Ptolemaic aspects in orb, for the lines inside the wheel. */
export function aspectGrid(date: Date): { a: PlanetId; b: PlanetId; aspect: AspectDef }[] {
  const out: { a: PlanetId; b: PlanetId; aspect: AspectDef }[] = [];
  for (let i = 0; i < PLANET_IDS.length; i++) {
    for (let j = i + 1; j < PLANET_IDS.length; j++) {
      const hit = currentAspect(PLANET_IDS[i], PLANET_IDS[j], date);
      if (hit) out.push({ a: PLANET_IDS[i], b: PLANET_IDS[j], aspect: hit.aspect });
    }
  }
  return out;
}
