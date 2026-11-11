"use client";

import { useEffect, useState } from "react";
import { API_ENABLED, type ChartRequest, type Reading, type ReadingSegment, fetchReading } from "@/lib/api";
import type { Judgement } from "@/lib/judgement";

const CAPTION: Record<string, string> = {
  yes: "По расчёту карты — похоже на «да»",
  hard: "По расчёту карты — с оговоркой",
  no: "По расчёту карты — похоже на «нет»",
  open: "По расчёту карты — нужен разбор",
};

type State = { s: "loading" } | { s: "done"; r: Reading } | { s: "error"; msg: string };

function Text({ segments }: { segments: ReadingSegment[] }) {
  return (
    <div className="reading">
      {segments.map((seg, i) => (
        <span key={i}>
          {seg.text}
          {seg.sources.map((n) => (
            <sup key={n}>
              <a href={`#src-${n}`} className="reading__ref">
                {n}
              </a>
            </sup>
          ))}
        </span>
      ))}
    </div>
  );
}

/**
 * The verdict of the result block. It comes from the books: as soon as the
 * chart is built the API casts it again, finds the passages that speak to it
 * and the model answers in three parts — verdict, short answer, detailed
 * reading. The short answer sits in the block; the detailed reading with its
 * quotes opens under it. The program's own verdict is shown only when the
 * book reading cannot be had.
 */
export default function BookVerdict({ chart, judgement: j }: { chart: ChartRequest; judgement: Judgement }) {
  const [state, setState] = useState<State>({ s: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!API_ENABLED) return;
    let live = true;
    fetchReading(chart)
      .then((r) => live && setState({ s: "done", r }))
      .catch((e) => live && setState({ s: "error", msg: e instanceof Error ? e.message : "Не удалось получить толкование." }));
    return () => {
      live = false;
    };
  }, [chart, attempt]);

  const fallback = (note: React.ReactNode) => (
    <div className={`verdict verdict--${j.verdict.tone}`}>
      <span className="verdict__label">{CAPTION[j.verdict.tone]}</span>
      <h3 className="verdict__title">{j.verdict.title}</h3>
      <p>{j.verdict.text}</p>
      {note}
    </div>
  );

  if (!API_ENABLED) {
    return fallback(<p className="verdict__note">Толкование по книгам подключается на следующем этапе.</p>);
  }

  if (state.s === "loading") {
    return (
      <div className="verdict verdict--loading" aria-busy="true" aria-live="polite">
        <span className="verdict__label">Толкование по книгам</span>
        <h3 className="verdict__title">Сверяем карту с книгами…</h3>
        <p>Ищем в книгах по прашне отрывки о вашем вопросе и составляем ответ. Это занимает до минуты.</p>
        <span className="verdict__bar" aria-hidden="true" />
      </div>
    );
  }

  if (state.s === "error") {
    return fallback(
      <div className="verdict__retry">
        <p className="verdict__note">Толкование по книгам не получено: {state.msg}</p>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => {
            setState({ s: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Попробовать ещё раз
        </button>
      </div>,
    );
  }

  const r = state.r;
  const tone = r.verdict?.tone ?? j.verdict.tone;
  // A footnote in the short answer points into the detailed reading: open it first.
  const openOnRef = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".reading__ref")) {
      const d = e.currentTarget.querySelector("details");
      if (d) d.open = true;
    }
  };
  return (
    <div className={`verdict verdict--${tone}`} onClick={openOnRef}>
      <span className="verdict__label">{r.verdict?.label ?? "Толкование по книгам"}</span>
      <h3 className="verdict__title">{r.verdict?.title ?? j.verdict.title}</h3>
      {r.summary?.length ? <Text segments={r.summary} /> : null}

      <details className="reading-more" open={!r.summary?.length}>
        <summary>
          <span className="btn btn-sm">Подробное толкование по книгам</span>
        </summary>
        <Text segments={r.segments} />
        {r.sources.length > 0 ? (
          <>
            <h4 className="reading-more__title">Цитаты из книг</h4>
            <ol className="reading__sources">
              {r.sources.map((s) => (
                <li key={s.n} id={`src-${s.n}`}>
                  <blockquote>«{s.quote}»</blockquote>
                  <cite>
                    {s.author ? `${s.author}. ` : ""}
                    {s.book}
                    {s.chapter ? ` — ${s.chapter}` : ""}
                  </cite>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="verdict__note">
            В загруженных книгах прямых цитат к этой карте не нашлось — толкование дано по общим правилам традиции.
          </p>
        )}
      </details>
    </div>
  );
}
