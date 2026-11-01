import { type Chart, PLANETS, ROMAN, SIGNS, norm } from "@/lib/astro";

/**
 * The chart wheel, drawn the traditional way round: the ascendant on the left
 * at nine o'clock, the signs running anticlockwise, the MC near the top.
 * Houses are equal, matching lib/astro.ts.
 */

const SIZE = 400;
const C = SIZE / 2;
const R_OUTER = 192;
const R_SIGNS = 160;
const R_PLANETS = 132;
const R_HOUSES = 78;
const R_INNER = 62;
/** Text presentation: without it some phones draw the glyphs as emoji. */
const TEXT = "︎";

export default function HoraryWheel({ chart, highlight = [] }: { chart: Chart; highlight?: string[] }) {
  const point = (lon: number, r: number) => {
    const a = Math.PI + norm(lon - chart.asc) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };

  // Planets closer than 9° get pushed apart along the ring so the glyphs
  // don't sit on top of each other; a short tick still marks the true degree.
  const placed = [...chart.planets]
    .sort((a, b) => norm(a.lon - chart.asc) - norm(b.lon - chart.asc))
    .map((p) => ({ ...p, shown: norm(p.lon - chart.asc) }));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].shown - placed[i - 1].shown < 9) placed[i].shown = placed[i - 1].shown + 9;
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="wheel"
      role="img"
      aria-label="Хорарная карта на момент вопроса"
    >
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

      {ROMAN.map((num, i) => {
        const cusp = chart.asc + i * 30;
        const a = point(cusp, R_INNER);
        const b = point(cusp, R_SIGNS);
        const n = point(cusp + 15, (R_INNER + R_HOUSES) / 2);
        const angular = i % 3 === 0;
        return (
          <g key={num}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={angular ? "wheel__axis" : "wheel__cusp"}
            />
            <text x={n.x} y={n.y} className="wheel__house">
              {num}
            </text>
          </g>
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
            {p.retrograde && (
              <text x={g.x + 12} y={g.y + 10} className="wheel__retro">
                R
              </text>
            )}
          </g>
        );
      })}

      <text x={C - R_INNER + 6} y={C - 6} className="wheel__label">
        ASC
      </text>
      <text x={point(chart.mc, R_INNER - 12).x} y={point(chart.mc, R_INNER - 12).y} className="wheel__label">
        MC
      </text>
    </svg>
  );
}
