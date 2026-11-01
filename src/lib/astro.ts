import { Body, Ecliptic, EclipticGeoMoon, GeoVector, SiderealTime, e_tilt, MakeTime } from "astronomy-engine";

/**
 * The chart for the moment of the question — real positions, worked out in
 * the browser. The judgement on top of it (lib/judgement.ts) is a first rough
 * pass; the full reading against the books comes with the backend.
 *
 * Houses are equal from the ascendant for now. Horary tradition casts
 * Regiomontanus, and that is what the backend will do; equal houses keep the
 * sign of every cusp right in most charts and need no more than the ASC.
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

export const PLANETS: Record<PlanetId, { name: string; glyph: string; body: Body }> = {
  sun: { name: "Солнце", glyph: "☉", body: Body.Sun },
  moon: { name: "Луна", glyph: "☽", body: Body.Moon },
  mercury: { name: "Меркурий", glyph: "☿", body: Body.Mercury },
  venus: { name: "Венера", glyph: "♀", body: Body.Venus },
  mars: { name: "Марс", glyph: "♂", body: Body.Mars },
  jupiter: { name: "Юпитер", glyph: "♃", body: Body.Jupiter },
  saturn: { name: "Сатурн", glyph: "♄", body: Body.Saturn },
};

/** Traditional rulers, Aries to Pisces — no outer planets in horary. */
export const SIGN_RULERS: PlanetId[] = [
  "mars", "venus", "mercury", "moon", "sun", "mercury",
  "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
];

export type PlanetPosition = {
  id: PlanetId;
  lon: number;
  retrograde: boolean;
  house: number;
};

export type Chart = {
  date: Date;
  lat: number;
  lon: number;
  asc: number;
  mc: number;
  planets: PlanetPosition[];
};

const rad = Math.PI / 180;
export const norm = (deg: number) => ((deg % 360) + 360) % 360;

export function longitude(id: PlanetId, date: Date): number {
  if (id === "moon") return EclipticGeoMoon(MakeTime(date)).lon;
  return Ecliptic(GeoVector(PLANETS[id].body, date, true)).elon;
}

export function houseOf(lon: number, asc: number): number {
  return Math.floor(norm(lon - asc) / 30) + 1;
}

export function castChart(date: Date, lat: number, lon: number): Chart {
  const time = MakeTime(date);
  const eps = e_tilt(time).tobl * rad;
  const ramc = norm(SiderealTime(date) * 15 + lon) * rad;
  const phi = lat * rad;

  const asc = norm(
    Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / rad,
  );
  const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / rad);

  const hourLater = new Date(date.getTime() + 3600_000);
  const planets = (Object.keys(PLANETS) as PlanetId[]).map((id) => {
    const now = longitude(id, date);
    const next = longitude(id, hourLater);
    // Signed step across the 0° Aries seam.
    const step = ((next - now + 540) % 360) - 180;
    return { id, lon: now, retrograde: step < 0, house: houseOf(now, asc) };
  });

  return { date, lat, lon, asc, mc, planets };
}

export function signIndex(lon: number): number {
  return Math.floor(norm(lon) / 30);
}

/** 14°23′ Скорпиона */
export function formatPosition(lon: number): string {
  const inSign = norm(lon) % 30;
  const deg = Math.floor(inSign);
  const min = Math.floor((inSign - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′ ${SIGNS[signIndex(lon)].gen}`;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
