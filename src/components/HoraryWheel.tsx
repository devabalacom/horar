import { type Chart, type ExtraId, type PlanetId, EXTRAS, PLANETS, SIGNS, delta, norm } from "@/lib/astro";
import type { AspectDef } from "@/lib/aspects";

/**
 * The chart wheel, drawn the traditional way round: the ascendant on the left
 * at nine o'clock and the signs running anticlockwise. Cusps are
 * Regiomontanus, so the houses are of unequal size.
 *
 * Rings, outside in: zodiac signs with a degree scale; cusp degrees; bodies
 * (the seven planets, then the outer planets and nodes, dimmer — shown for
 * context, not judged by); house numbers; aspect lines in the centre.
 */

const SIZE = 520;
const C = SIZE / 2;
const R_OUTER = 252;
const R_SIGNS = 218;
const R_CUSPDEG = 204;
const R_PLANETS = 176;
const R_DEGREES = 154;
const R_HOUSES = 136;
const R_INNER = 112;
/** Text presentation: without it some phones draw the glyphs as emoji. */
const TEXT = "︎";

/** Aspects drawn between the outer bodies, with a flat orb. */
const OUTER_ORB = 4;
const ANGLES: { angle: number; tone: AspectDef["tone"] }[] = [
  { angle: 0, tone: "good" },
  { angle: 60, tone: "good" },
  { angle: 90, tone: "hard" },
  { angle: 120, tone: "good" },
  { angle: 180, tone: "bad" },
];

type Body = { key: string; glyph: string; lon: number; retro: boolean; traditional: boolean; id: PlanetId | ExtraId };

type Props = {
  chart: Chart;
  highlight?: PlanetId[];
  grid?: { a: PlanetId; b: PlanetId; aspect: AspectDef }[];
};

const dm = (lon: number) => {
  const inSign = norm(lon) % 30;
  let d = Math.floor(inSign);
  let m = Math.round((inSign - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return { d, m };
};

/**
 * Spreads bodies round the ring so no two are closer than `gap` degrees:
 * runs of bodies that crowd each other are laid out evenly about their
 * middle, merging runs until none overlap.
 */
function spread<T extends { shown: number }>(items: T[], gap: number): T[] {
  const out = items.map((x) => ({ ...x })).sort((a, b) => a.shown - b.shown);
  const n = out.length;
  if (n < 2 || n * gap >= 360) return out;
  // Start the scan at the widest empty arc so no cluster straddles it.
  let start = 0;
  let widest = -1;
  for (let i = 0; i < n; i++) {
    const g = norm(out[(i + 1) % n].shown - out[i].shown);
    if (g > widest) {
      widest = g;
      start = (i + 1) % n;
    }
  }
  const base = out[start].shown;
  const pos = Array.from({ length: n }, (_, k) => {
    const item = out[(start + k) % n];
    return { item, raw: norm(item.shown - base) };
  });
  const groups = pos.map((p) => ({ members: [p], centre: p.raw }));
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i + 1 < groups.length; i++) {
      const g = groups[i];
      const h = groups[i + 1];
      const gEnd = g.centre + ((g.members.length - 1) * gap) / 2;
      const hStart = h.centre - ((h.members.length - 1) * gap) / 2;
      if (hStart - gEnd < gap) {
        const members = [...g.members, ...h.members];
        const centre = members.reduce((s, m) => s + m.raw, 0) / members.length;
        groups.splice(i, 2, { members, centre });
        changed = true;
        break;
      }
    }
  }
  for (const g of groups) {
    g.members.forEach((m, k) => {
      m.item.shown = norm(base + g.centre + (k - (g.members.length - 1) / 2) * gap);
    });
  }
  return out;
}

export default function HoraryWheel({ chart, highlight = [], grid = [] }: Props) {
  const point = (lon: number, r: number) => {
    const a = Math.PI + norm(lon - chart.asc) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };

  const bodies: Body[] = [
    ...chart.planets.map((p) => ({
      key: p.id, id: p.id, glyph: PLANETS[p.id].glyph, lon: p.lon, retro: p.speed < 0, traditional: true,
    })),
    ...chart.extras.map((e) => ({
      key: e.id, id: e.id, glyph: EXTRAS[e.id].glyph, lon: e.lon, retro: e.speed < 0 && !e.id.toLowerCase().includes("node"), traditional: false,
    })),
  ];

  // Bodies closer than GAP degrees are pushed apart along the ring, both ways
  // round, so the glyphs don't sit on each other; a tick on the sign ring
  // still marks the true degree.
  const GAP = 11;
  const placed = spread(
    bodies.map((b) => ({ ...b, shown: norm(b.lon - chart.asc) })),
    GAP,
  );

  // Aspect lines: the traditional grid (Lilly's orbs) plus the outer bodies
  // with a flat orb, drawn fainter.
  const lonOf = (id: string) => bodies.find((b) => b.key === id)!.lon;
  const outerLines: { a: string; b: string; tone: AspectDef["tone"] }[] = [];
  const outer = bodies.filter((b) => !b.traditional && b.id !== "southNode");
  for (const o of outer) {
    for (const b of bodies) {
      if (b.key === o.key || b.id === "southNode" || (!b.traditional && b.key <= o.key)) continue;
      const sep = Math.abs(delta(o.lon, b.lon));
      const hit = ANGLES.find((x) => Math.abs(sep - x.angle) <= OUTER_ORB);
      if (hit) outerLines.push({ a: o.key, b: b.key, tone: hit.tone });
    }
  }

  const ascAt = point(chart.asc, (R_INNER + R_HOUSES) / 2);
  const mcAt = point(chart.mc, (R_INNER + R_HOUSES) / 2);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel" role="img" aria-label="Хорарная карта на момент вопроса">
      <circle cx={C} cy={C} r={R_OUTER} className="wheel__ring" />
      <circle cx={C} cy={C} r={R_SIGNS} className="wheel__ring" />
      <circle cx={C} cy={C} r={R_HOUSES} className="wheel__ring wheel__ring--soft" />
      <circle cx={C} cy={C} r={R_INNER} className="wheel__ring wheel__ring--soft" />

      {/* degree scale on the inside of the zodiac ring */}
      {Array.from({ length: 360 }, (_, deg) => {
        const len = deg % 10 === 0 ? 7 : deg % 5 === 0 ? 5 : 2.5;
        const a = point(deg, R_SIGNS);
        const b = point(deg, R_SIGNS - len);
        return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="wheel__scale" />;
      })}

      {SIGNS.map((sign, i) => {
        const a = point(i * 30, R_SIGNS);
        const b = point(i * 30, R_OUTER);
        const g = point(i * 30 + 15, (R_SIGNS + R_OUTER) / 2);
        return (
          <g key={sign.name}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="wheel__ring" />
            <text x={g.x} y={g.y} className={`wheel__sign wheel__sign--${i % 4}`}>
              {sign.glyph + TEXT}
            </text>
          </g>
        );
      })}

      {chart.cusps.map((cusp, i) => {
        const a = point(cusp, R_INNER);
        const b = point(cusp, R_SIGNS);
        const next = chart.cusps[(i + 1) % 12];
        const n = point(cusp + norm(next - cusp) / 2, (R_INNER + R_HOUSES) / 2);
        const angular = i % 3 === 0;
        // Cusp degree, written just past the cusp line inside its house.
        const { d, m } = dm(cusp);
        const lbl = point(cusp + 3.2, R_CUSPDEG);
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={angular ? "wheel__axis" : "wheel__cusp"} />
            <text x={n.x} y={n.y} className="wheel__house">
              {i + 1}
            </text>
            <text x={lbl.x} y={lbl.y} className="wheel__cuspdeg">
              {`${d}°${SIGNS[Math.floor(norm(cusp) / 30)].glyph}${TEXT}${String(m).padStart(2, "0")}′`}
            </text>
          </g>
        );
      })}

      {outerLines.map(({ a, b, tone }) => {
        const p = point(lonOf(a), R_INNER);
        const q = point(lonOf(b), R_INNER);
        return <line key={`o-${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`wheel__aspect wheel__aspect--faint wheel__aspect--${tone}`} />;
      })}
      {grid.map(({ a, b, aspect }) => {
        const p = point(lonOf(a), R_INNER);
        const q = point(lonOf(b), R_INNER);
        return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`wheel__aspect wheel__aspect--${aspect.tone}`} />;
      })}
      {bodies.map((b) => {
        const q = point(b.lon, R_INNER);
        return <circle key={`dot-${b.key}`} cx={q.x} cy={q.y} r={b.traditional ? 2.2 : 1.6} className="wheel__dot" />;
      })}

      {placed.map((p) => {
        const tickA = point(p.lon, R_SIGNS);
        const tickB = point(p.lon, R_SIGNS - 9);
        const g = point(chart.asc + p.shown, R_PLANETS);
        const dl = point(chart.asc + p.shown, R_DEGREES);
        const on = p.traditional && highlight.includes(p.id as PlanetId);
        const { d, m } = dm(p.lon);
        return (
          <g key={p.key} className={`wheel__planet${on ? " is-on" : ""}${p.traditional ? "" : " is-extra"}`}>
            <line x1={tickA.x} y1={tickA.y} x2={tickB.x} y2={tickB.y} />
            {on && <circle cx={g.x} cy={g.y} r={14} className="wheel__halo" />}
            <title>{`${p.traditional ? PLANETS[p.id as PlanetId].name : EXTRAS[p.id as ExtraId].name} ${d}°${String(m).padStart(2, "0")}′ ${SIGNS[Math.floor(norm(p.lon) / 30)].gen}${p.retro ? ", ретроградно" : ""}`}</title>
            <text x={g.x} y={g.y} className="wheel__glyph">
              {p.glyph + TEXT}
            </text>
            <text x={dl.x} y={dl.y} className="wheel__deg">
              {`${d}°`}
              {p.retro ? "R" : ""}
            </text>
          </g>
        );
      })}

      <text x={ascAt.x} y={ascAt.y} className="wheel__label wheel__label--axis">
        ASC
      </text>
      <text x={mcAt.x} y={mcAt.y} className="wheel__label wheel__label--axis">
        MC
      </text>
    </svg>
  );
}
