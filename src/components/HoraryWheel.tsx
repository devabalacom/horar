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
const R_PLANETS = 150;
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

  // Planets closer than 10° get pushed apart along the ring so the glyphs
  // don't sit on top of each other; a tick still marks the true degree.
  const placed = [...chart.planets]
    .sort((a, b) => norm(a.lon - chart.asc) - norm(b.lon - chart.asc))
    .map((p) => ({ ...p, shown: norm(p.lon - chart.asc) }));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].shown - placed[i - 1].shown < 10) placed[i].shown = placed[i - 1].shown + 10;
  }

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

      {placed.map((p) => {
        const tickA = point(p.lon, R_SIGNS);
        const tickB = point(p.lon, R_SIGNS - 8);
        const g = point(chart.asc + p.shown, R_PLANETS);
        const on = highlight.includes(p.id);
        return (
          <g key={p.id} className={on ? "wheel__planet is-on" : "wheel__planet"}>
            <line x1={tickA.x} y1={tickA.y} x2={tickB.x} y2={tickB.y} />
            {on && <circle cx={g.x} cy={g.y} r={15} className="wheel__halo" />}
            <text x={g.x} y={g.y}>
              {PLANETS[p.id].glyph + TEXT}
            </text>
            {p.speed < 0 && (
              <text x={g.x + 13} y={g.y + 10} className="wheel__retro">
                R
              </text>
            )}
          </g>
        );
      })}

      <text x={point(chart.asc, R_HOUSES + 12).x} y={point(chart.asc, R_HOUSES + 12).y - 8} className="wheel__label">
        ASC
      </text>
      <text x={point(chart.mc, R_HOUSES + 12).x + 12} y={point(chart.mc, R_HOUSES + 12).y} className="wheel__label">
        MC
      </text>
    </svg>
  );
}
