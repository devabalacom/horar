import { type PlanetId, SIGN_RULERS, degInSign, signIndex } from "@/lib/astro";

/**
 * Essential dignities as Lilly used them: domicile, exaltation, triplicity
 * (his day/night rulers, Mars for water both ways), Egyptian terms and
 * Chaldean faces — and the debilities, detriment and fall.
 */

const EXALTATION: Partial<Record<PlanetId, number>> = {
  sun: 0, moon: 1, mercury: 5, venus: 11, mars: 9, jupiter: 3, saturn: 6,
};

/** Fire, earth, air, water: [day, night]. */
export const TRIPLICITY: [PlanetId, PlanetId][] = [
  ["sun", "jupiter"],
  ["venus", "moon"],
  ["saturn", "mercury"],
  ["mars", "mars"],
];

/** Egyptian terms: [ruler, end degree] for each sign, Aries first. */
const TERMS: [PlanetId, number][][] = [
  [["jupiter", 6], ["venus", 12], ["mercury", 20], ["mars", 25], ["saturn", 30]],
  [["venus", 8], ["mercury", 14], ["jupiter", 22], ["saturn", 27], ["mars", 30]],
  [["mercury", 6], ["jupiter", 12], ["venus", 17], ["mars", 24], ["saturn", 30]],
  [["mars", 7], ["venus", 13], ["mercury", 19], ["jupiter", 26], ["saturn", 30]],
  [["jupiter", 6], ["venus", 11], ["saturn", 18], ["mercury", 24], ["mars", 30]],
  [["mercury", 7], ["venus", 17], ["jupiter", 21], ["mars", 28], ["saturn", 30]],
  [["saturn", 6], ["mercury", 14], ["jupiter", 21], ["venus", 28], ["mars", 30]],
  [["mars", 7], ["venus", 11], ["mercury", 19], ["jupiter", 24], ["saturn", 30]],
  [["jupiter", 12], ["venus", 17], ["mercury", 21], ["saturn", 26], ["mars", 30]],
  [["mercury", 7], ["jupiter", 14], ["venus", 22], ["saturn", 26], ["mars", 30]],
  [["mercury", 7], ["venus", 13], ["jupiter", 20], ["mars", 25], ["saturn", 30]],
  [["venus", 12], ["jupiter", 16], ["mercury", 19], ["mars", 28], ["saturn", 30]],
];

/** Faces run in Chaldean order from Mars at 0° Aries. */
const FACE_ORDER: PlanetId[] = ["mars", "sun", "venus", "mercury", "moon", "saturn", "jupiter"];

export type DignityKind = "domicile" | "exaltation" | "triplicity" | "term" | "face";

export const DIGNITY_LABELS: Record<DignityKind, { name: string; via: string }> = {
  domicile: { name: "обитель", via: "через управление" },
  exaltation: { name: "экзальтация", via: "через экзальтацию" },
  triplicity: { name: "триплицитность", via: "через триплицитность" },
  term: { name: "терм", via: "через терм" },
  face: { name: "лик", via: "через лик" },
};

/** Who rules each dignity at a point of the zodiac. */
export function rulersAt(lon: number, isDay: boolean): Record<DignityKind, PlanetId | null> {
  const sign = signIndex(lon);
  const deg = degInSign(lon);
  const exalted = (Object.keys(EXALTATION) as PlanetId[]).find((p) => EXALTATION[p] === sign) ?? null;
  return {
    domicile: SIGN_RULERS[sign],
    exaltation: exalted,
    triplicity: TRIPLICITY[sign % 4][isDay ? 0 : 1],
    term: TERMS[sign].find(([, end]) => deg < end)![0],
    face: FACE_ORDER[(sign * 3 + Math.floor(deg / 10)) % 7],
  };
}

export type PlanetState = {
  dignities: DignityKind[];
  detriment: boolean;
  fall: boolean;
  peregrine: boolean;
  /** Dispositors: the planets that receive this one, and through what. */
  receivedBy: { planet: PlanetId; via: DignityKind[] }[];
};

export function planetState(id: PlanetId, lon: number, isDay: boolean): PlanetState {
  const rulers = rulersAt(lon, isDay);
  const sign = signIndex(lon);
  const kinds = Object.keys(rulers) as DignityKind[];
  const dignities = kinds.filter((k) => rulers[k] === id);
  const detriment = SIGN_RULERS[(sign + 6) % 12] === id;
  const fall = EXALTATION[id] !== undefined && (EXALTATION[id]! + 6) % 12 === sign;

  const receivedBy: PlanetState["receivedBy"] = [];
  for (const k of kinds) {
    const r = rulers[k];
    if (!r || r === id) continue;
    const entry = receivedBy.find((x) => x.planet === r);
    if (entry) entry.via.push(k);
    else receivedBy.push({ planet: r, via: [k] });
  }

  return { dignities, detriment, fall, peregrine: dignities.length === 0, receivedBy };
}

export function describeState(s: PlanetState): string {
  const parts = s.dignities.map((d) => DIGNITY_LABELS[d].name);
  if (s.detriment) parts.push("изгнание");
  if (s.fall) parts.push("падение");
  if (s.peregrine) parts.push("перегрин");
  return parts.join(", ");
}

const STRONG: DignityKind[] = ["domicile", "exaltation"];

export type Reception = {
  aInB: DignityKind[];
  bInA: DignityKind[];
  strength: "strong" | "weak" | "one-way" | "none";
};

/** Whether a stands in b's dignities, and b in a's. */
export function reception(a: PlanetId, aLon: number, b: PlanetId, bLon: number, isDay: boolean): Reception {
  const at = (lon: number, p: PlanetId) => {
    const r = rulersAt(lon, isDay);
    return (Object.keys(r) as DignityKind[]).filter((k) => r[k] === p);
  };
  const aInB = at(aLon, b);
  const bInA = at(bLon, a);
  let strength: Reception["strength"] = "none";
  if (aInB.length && bInA.length) {
    strength = aInB.some((k) => STRONG.includes(k)) && bInA.some((k) => STRONG.includes(k)) ? "strong" : "weak";
  } else if (aInB.length || bInA.length) {
    strength = "one-way";
  }
  return { aInB, bInA, strength };
}

export function viaList(kinds: DignityKind[]): string {
  return kinds.map((k) => DIGNITY_LABELS[k].via).join(", ");
}
