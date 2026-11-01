import {
  type Chart,
  type PlanetId,
  PLANETS,
  ROMAN,
  SIGN_RULERS,
  formatPosition,
  longitude,
  norm,
  signIndex,
} from "@/lib/astro";

/**
 * A first, mechanical pass over the chart: who signifies whom, whether their
 * significators meet by an applying aspect, and the classic considerations
 * before judgement. It stands in for the reading the backend will give from
 * the books — the facts are real, the verdict is only the aspect's.
 */

const ASPECTS = [
  { angle: 0, name: "соединение", tone: "good" },
  { angle: 60, name: "секстиль", tone: "good" },
  { angle: 90, name: "квадрат", tone: "hard" },
  { angle: 120, name: "трин", tone: "good" },
  { angle: 180, name: "оппозиция", tone: "bad" },
] as const;

const ORB = 8;

export type Factor = { label: string; value: string; note?: string };
export type Verdict = { tone: "yes" | "hard" | "no" | "open"; title: string; text: string };

export type Judgement = {
  querent: PlanetId;
  quesited: PlanetId | null;
  factors: Factor[];
  considerations: string[];
  verdict: Verdict;
};

function separation(a: number, b: number): number {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
}

function findAspect(a: PlanetId, b: PlanetId, date: Date) {
  const later = new Date(date.getTime() + 3600_000);
  const sepNow = separation(longitude(a, date), longitude(b, date));
  const sepLater = separation(longitude(a, later), longitude(b, later));
  for (const aspect of ASPECTS) {
    const orb = Math.abs(sepNow - aspect.angle);
    if (orb <= ORB) {
      const applying = Math.abs(sepLater - aspect.angle) < orb;
      return { ...aspect, orb, applying };
    }
  }
  return null;
}

function where(chart: Chart, id: PlanetId): string {
  const p = chart.planets.find((x) => x.id === id)!;
  return `${formatPosition(p.lon)}, ${ROMAN[p.house - 1]} дом${p.retrograde ? ", ретроградный" : ""}`;
}

export function judge(chart: Chart, quesitedHouse: number | null): Judgement {
  const querent = SIGN_RULERS[signIndex(chart.asc)];
  const quesitedCusp = quesitedHouse ? norm(chart.asc + (quesitedHouse - 1) * 30) : null;
  const quesited = quesitedCusp === null ? null : SIGN_RULERS[signIndex(quesitedCusp)];

  const moon = chart.planets.find((p) => p.id === "moon")!;
  const sun = chart.planets.find((p) => p.id === "sun")!;
  const waxing = norm(moon.lon - sun.lon) < 180;

  const factors: Factor[] = [
    { label: "Асцендент", value: formatPosition(chart.asc) },
    {
      label: "Сигнификатор спрашивающего",
      value: `${PLANETS[querent].name}`,
      note: where(chart, querent),
    },
  ];
  if (quesited && quesitedHouse) {
    factors.push({
      label: `Сигнификатор вопроса (${ROMAN[quesitedHouse - 1]} дом)`,
      value: PLANETS[quesited].name,
      note: where(chart, quesited),
    });
  }
  factors.push({
    label: "Луна — со-сигнификатор",
    value: formatPosition(moon.lon),
    note: `${ROMAN[moon.house - 1]} дом, ${waxing ? "растущая" : "убывающая"}`,
  });

  const considerations: string[] = [];
  const ascDeg = norm(chart.asc) % 30;
  if (ascDeg < 3) considerations.push("Ранний асцендент: вопрос, возможно, задан преждевременно — ситуация ещё не сложилась.");
  if (ascDeg > 27) considerations.push("Поздний асцендент: дело, вероятно, уже решено, и повлиять на него сложно.");
  if (moon.lon >= 195 && moon.lon <= 225) considerations.push("Луна в Via Combusta (15° Весов — 15° Скорпиона): обстоятельства неустойчивы.");
  const saturn = chart.planets.find((p) => p.id === "saturn")!;
  if (saturn.house === 7) considerations.push("Сатурн в VII доме: классическое предупреждение астрологу — суждение может быть ошибочным.");

  let verdict: Verdict;
  if (!quesited) {
    verdict = {
      tone: "open",
      title: "Тема не выбрана",
      text: "Чтобы найти сигнификатор вопроса, выберите тему — по ней определяется дом. Ниже — общие факторы карты.",
    };
  } else if (quesited === querent) {
    verdict = {
      tone: "open",
      title: "Один управитель на двоих",
      text: `${PLANETS[querent].name} управляет и вами, и предметом вопроса. В таком случае решение ищут по Луне и её ближайшим аспектам.`,
    };
  } else {
    const aspect = findAspect(querent, quesited, chart.date);
    const pair = `${PLANETS[querent].name} и ${PLANETS[quesited].name}`;
    if (!aspect) {
      verdict = {
        tone: "open",
        title: "Аспекта между сигнификаторами нет",
        text: `${pair} не связаны мажорным аспектом. Ответ ищут в переводе или собирании света — это сделает полный разбор.`,
      };
    } else if (!aspect.applying) {
      verdict = {
        tone: "no",
        title: `${capitalize(aspect.name)} расходится`,
        text: `${pair} в аспекте «${aspect.name}» (орб ${aspect.orb.toFixed(1)}°), но он уже расходится: главное событие, вероятно, позади.`,
      };
    } else {
      const map = {
        good: { tone: "yes", title: "Скорее да" },
        hard: { tone: "hard", title: "Да, но через трудности" },
        bad: { tone: "no", title: "Скорее нет — или с сожалением" },
      } as const;
      verdict = {
        ...map[aspect.tone],
        text: `${pair} сходятся в аспекте «${aspect.name}», до точного — ${aspect.orb.toFixed(1)}°. Сходящийся аспект показывает, что дело придёт к развязке.`,
      };
    }
  }

  return { querent, quesited, factors, considerations, verdict };
}

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
