import {
  Body,
  Ecliptic,
  EclipticGeoMoon,
  GeoVector,
  MakeTime,
  Observer,
  SearchRiseSet,
  SiderealTime,
  e_tilt,
} from "astronomy-engine";

/**
 * The chart for the moment of the question, worked out in the browser:
 * the seven traditional planets, Regiomontanus houses (the horary standard
 * since Lilly), day or night, and the planetary hour.
 */

export const SIGNS = [
  { name: "Овен", gen: "Овна", glyph: "♈" },
  { name: "Телец", gen: "Тельца", glyph: "♉" },
  { name: "Близнецы", gen: "Близнецов", glyph: "♊" },
  { name: "Рак", gen: "Рака", glyph: "♋" },
  { name: "Лев", gen: "Льва", glyph: "♌" },
  { name: "Дева", gen: "Девы", glyph: "♍" },
  { name: "Весы", gen: "Весов", glyph: "♎" },
  { name: "Скорпион", gen: "Скорпиона", glyph: "♏" },
  { name: "Стрелец", gen: "Стрельца", glyph: "♐" },
  { name: "Козерог", gen: "Козерога", glyph: "♑" },
  { name: "Водолей", gen: "Водолея", glyph: "♒" },
  { name: "Рыбы", gen: "Рыб", glyph: "♓" },
] as const;

export type PlanetId = "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn";

export const PLANET_IDS: PlanetId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

export const PLANETS: Record<PlanetId, { name: string; gen: string; glyph: string; body: Body }> = {
  sun: { name: "Солнце", gen: "Солнца", glyph: "☉", body: Body.Sun },
  moon: { name: "Луна", gen: "Луны", glyph: "☽", body: Body.Moon },
  mercury: { name: "Меркурий", gen: "Меркурия", glyph: "☿", body: Body.Mercury },
  venus: { name: "Венера", gen: "Венеры", glyph: "♀", body: Body.Venus },
  mars: { name: "Марс", gen: "Марса", glyph: "♂", body: Body.Mars },
  jupiter: { name: "Юпитер", gen: "Юпитера", glyph: "♃", body: Body.Jupiter },
  saturn: { name: "Сатурн", gen: "Сатурна", glyph: "♄", body: Body.Saturn },
};

/** Traditional rulers, Aries to Pisces. */
export const SIGN_RULERS: PlanetId[] = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
];

/** Chaldean order — the sequence of the planetary hours. */
const CHALDEAN: PlanetId[] = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"];
/** Rulers of the days of the week, Sunday first. */
const DAY_RULERS: PlanetId[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];

export type PlanetPosition = {
  id: PlanetId;
  lon: number;
  /** Degrees per day; negative when retrograde. */
  speed: number;
  /** The house it stands in by the cusps. */
  house: number;
  /** The house it is read in: within 5° of the next cusp counts as in it. */
  readHouse: number;
};

export type Chart = {
  date: Date;
  lat: number;
  lng: number;
  tz: string;
  asc: number;
  mc: number;
  /** Twelve cusps, house I first. */
  cusps: number[];
  planets: PlanetPosition[];
  isDay: boolean;
  hourRuler: PlanetId | null;
};

const rad = Math.PI / 180;
export const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Signed shortest difference b − a, in (−180, 180]. */
export const delta = (a: number, b: number) => ((b - a + 540) % 360) - 180;

export function longitude(id: PlanetId, date: Date): number {
  if (id === "moon") return EclipticGeoMoon(MakeTime(date)).lon;
  return Ecliptic(GeoVector(PLANETS[id].body, date, true)).elon;
}

export function speedOf(id: PlanetId, date: Date): number {
  const half = 6 * 3600_000;
  return delta(longitude(id, new Date(date.getTime() - half)), longitude(id, new Date(date.getTime() + half))) * 2;
}

/**
 * Regiomontanus: the cusps are where the ecliptic crosses great circles that
 * divide the celestial equator into twelve equal parts, all through the north
 * and south points of the horizon. `a` is the cusp's distance from the
 * meridian along the equator — 0 for the MC, 90 for the ascendant.
 */
function regioCusp(ramc: number, eps: number, phi: number, a: number): number {
  const r = (ramc + a) * rad;
  const pole = Math.atan(Math.tan(phi) * Math.sin(a * rad));
  return norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps) - Math.tan(pole) * Math.sin(eps)) / rad);
}

export function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const span = norm(cusps[(i + 1) % 12] - cusps[i]);
    if (norm(lon - cusps[i]) < span) return i + 1;
  }
  return 1;
}

function readHouseOf(lon: number, cusps: number[]): number {
  const h = houseOf(lon, cusps);
  return norm(cusps[h % 12] - lon) <= 5 ? (h % 12) + 1 : h;
}

function planetaryHour(date: Date, lat: number, lng: number, tz: string): PlanetId | null {
  const obs = new Observer(lat, lng, 0);
  const prevRise = SearchRiseSet(Body.Sun, obs, +1, date, -1.2)?.date;
  const prevSet = SearchRiseSet(Body.Sun, obs, -1, date, -1.2)?.date;
  if (!prevRise || !prevSet) return null; // polar day or night
  const t = date.getTime();
  let start: Date;
  let index: number;
  if (prevRise > prevSet) {
    const nextSet = SearchRiseSet(Body.Sun, obs, -1, date, 1.2)?.date;
    if (!nextSet) return null;
    start = prevRise;
    index = Math.floor((t - prevRise.getTime()) / ((nextSet.getTime() - prevRise.getTime()) / 12));
  } else {
    const nextRise = SearchRiseSet(Body.Sun, obs, +1, date, 1.2)?.date;
    if (!nextRise) return null;
    start = prevSet;
    index = 12 + Math.floor((t - prevSet.getTime()) / ((nextRise.getTime() - prevSet.getTime()) / 12));
  }
  // The planetary day runs sunrise to sunrise and takes the weekday of the
  // sunrise it began with — for a night hour, the day the sun set on.
  const weekday = localParts(start, tz).weekday;
  const dayRuler = DAY_RULERS[weekday];
  return CHALDEAN[(CHALDEAN.indexOf(dayRuler) + index) % 7];
}

export function castChart(date: Date, lat: number, lng: number, tz: string): Chart {
  const eps = e_tilt(MakeTime(date)).tobl * rad;
  const ramc = norm(SiderealTime(date) * 15 + lng);
  const phi = lat * rad;

  const mc = regioCusp(ramc, eps, phi, 0);
  const asc = regioCusp(ramc, eps, phi, 90);
  const c11 = regioCusp(ramc, eps, phi, 30);
  const c12 = regioCusp(ramc, eps, phi, 60);
  const c2 = regioCusp(ramc, eps, phi, 120);
  const c3 = regioCusp(ramc, eps, phi, 150);
  const cusps = [asc, c2, c3, mc + 180, c11 + 180, c12 + 180, asc + 180, c2 + 180, c3 + 180, mc, c11, c12].map(norm);

  const planets = PLANET_IDS.map((id) => {
    const lon = longitude(id, date);
    return { id, lon, speed: speedOf(id, date), house: houseOf(lon, cusps), readHouse: readHouseOf(lon, cusps) };
  });

  const sun = planets.find((p) => p.id === "sun")!;
  return {
    date,
    lat,
    lng,
    tz,
    asc,
    mc,
    cusps,
    planets,
    isDay: sun.house >= 7,
    hourRuler: planetaryHour(date, lat, lng, tz),
  };
}

export function signIndex(lon: number): number {
  return Math.floor(norm(lon) / 30);
}

export function degInSign(lon: number): number {
  return norm(lon) % 30;
}

/** 14°23′ Скорпиона */
export function formatPosition(lon: number): string {
  const inSign = degInSign(lon);
  let deg = Math.floor(inSign);
  let min = Math.round((inSign - deg) * 60);
  if (min === 60) {
    deg += 1;
    min = 0;
  }
  return `${deg}°${String(min).padStart(2, "0")}′ ${SIGNS[signIndex(lon)].gen}`;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/* ---------- time zones ---------- */

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock reading of an instant in a time zone. */
export function localParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** The instant a wall-clock time in a time zone stands for. */
export function zonedToDate(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (t: number) => {
    const p = localParts(new Date(t), tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(t / 60_000) * 60_000;
  };
  let t = wall - offsetAt(wall);
  const second = offsetAt(t);
  if (wall - second !== t) t = wall - second;
  return new Date(t);
}
