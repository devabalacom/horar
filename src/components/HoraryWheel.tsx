import { type Chart, type PlanetId, PLANETS, ROMAN, SIGNS, norm } from "@/lib/astro";
import type { AspectDef } from "@/lib/aspects";

/**
 * The chart wheel, drawn the traditional way round: the ascendant on the left
 * at nine o'clock and the signs running anticlockwise. Cusps are
 * Regiomontanus, so the houses are of unequal size.
 */

const SIZE = 440;
const C = SIZE / 2;
const R_OUTER = 212;
const R_SIGNS = 180;
const R_PLANETS = 154;
const R_DEGREES = 128;
const R_HOUSES = 104;
const R_INNER = 86;
/** Text presentation: without it some phones draw the glyphs as emoji. */
const TEXT = "︎";

type Props = {
  chart: Chart;
  highlight?: PlanetId[];
  grid?: { a: PlanetId; b: PlanetId; aspect: AspectDef }[];
};

export default function HoraryWheel({ chart, highlight = [], grid = [] }: Props) {
  const point = (lon: number, r: number) => {
    const a = Math.PI + norm(lon - chart.asc) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };
  const lonOf = (id: PlanetId) => chart.planets.find((p) => p.id === id)!.lon;

  // Planets closer than GAP degrees are pushed apart along the ring, both
  // ways round, so the glyphs don't sit on each other; a tick on the sign
  // ring still marks the true degree.
  const GAP = 12;
  const placed = [...chart.planets]
    .sort((a, b) => norm(a.lon - chart.asc) - norm(b.lon - chart.asc))
    .map((p) => ({ ...p, shown: norm(p.lon - chart.asc) }));
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      const b = placed[(i + 1) % placed.length];
      const gap = norm(b.shown - a.shown);
      if (placed.length > 1 && gap < GAP) {
        const push = (GAP - gap) / 2 + 0.01;
        a.shown = norm(a.shown - push);
        b.shown = norm(b.shown + push);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const degreeOf = (lon: number) => `${Math.floor(norm(lon) % 30)}°`;

  // Axis labels sit on their axis in the house-number ring: house numbers
  // are mid-house, so the cusp itself is free there.
  const ascAt = point(chart.asc, (R_INNER + R_HOUSES) / 2);
  const mcAt = point(chart.mc, (R_INNER + R_HOUSES) / 2);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel" role="img" aria-label="Хорарная карта на момент вопроса">
      <circle cx={C} cy={C} r={R_OUTER} className="wheel__ring" />
      <circle cx={C} cy={C} r={R_SIGNS} className="wheel__ring" />
      <circle cx={C} cy={C} r={R_HOUSES} className="wheel__ring wheel__ring--soft" />
      <circle cx={C} cy={C} r={R_INNER} className="wheel__ring wheel__ring--soft" />

      {SIGNS.map((sign, i) => {
        const a = point(i * 30, R_SIGNS);
        const b = point(i * 30, R_OUTER);
        const g = point(i * 30 + 15, (R_SIGNS + R_OUTER) / 2);
        return (
          <g key={sign.name}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="wheel__ring" />
            <text x={g.x} y={g.y} className="wheel__sign">
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
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={angular ? "wheel__axis" : "wheel__cusp"} />
            <text x={n.x} y={n.y} className="wheel__house">
              {ROMAN[i]}
            </text>
          </g>
        );
      })}

      {grid.map(({ a, b, aspect }) => {
        const p = point(lonOf(a), R_INNER);
        const q = point(lonOf(b), R_INNER);
        return (
          <line
            key={`${a}-${b}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            className={`wheel__aspect wheel__aspect--${aspect.tone}`}
          />
        );
      })}

      {grid.map(({ a, b }) =>
        [a, b].map((id) => {
          const q = point(lonOf(id), R_INNER);
          return <circle key={`${a}-${b}-${id}`} cx={q.x} cy={q.y} r={2} className="wheel__dot" />;
        }),
      )}

      {placed.map((p) => {
        const tickA = point(p.lon, R_SIGNS);
        const tickB = point(p.lon, R_SIGNS - 7);
        const g = point(chart.asc + p.shown, R_PLANETS);
        const d = point(chart.asc + p.shown, R_DEGREES);
        const on = highlight.includes(p.id);
        return (
          <g key={p.id} className={on ? "wheel__planet is-on" : "wheel__planet"}>
            <line x1={tickA.x} y1={tickA.y} x2={tickB.x} y2={tickB.y} />
            {on && <circle cx={g.x} cy={g.y} r={14} className="wheel__halo" />}
            <text x={g.x} y={g.y} className="wheel__glyph">
              {PLANETS[p.id].glyph + TEXT}
            </text>
            <text x={d.x} y={d.y} className="wheel__deg">
              {degreeOf(p.lon)}
              {p.speed < 0 ? " R" : ""}
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
