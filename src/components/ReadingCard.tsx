"use client";

import { useState } from "react";
import { API_ENABLED, type ChartRequest, type Reading, fetchReading } from "@/lib/api";

/**
 * «Толкование по книгам»: on request, the API casts the same chart, finds
 * the passages of the books that speak to it and has the model write the
 * reading. Numbers in the text point at the quoted passages below it.
 */
export default function ReadingCard({ chart }: { chart: ChartRequest }) {
  const [state, setState] = useState<
    { s: "idle" } | { s: "loading" } | { s: "done"; r: Reading } | { s: "error"; msg: string }
  >({ s: "idle" });

  if (!API_ENABLED) {
    return (
      <article className="r-card r-card--pending">
        <h3 className="r-card__title">Толкование по книгам</h3>
        <p className="r-card__lead">
          Развёрнутый ответ на ваш вопрос: что показывает карта, когда ждать развязки и цитаты из глав
          классических книг, на которые опирается вывод. Подключаем на следующем этапе.
        </p>
      </article>
    );
  }

  async function load() {
    setState({ s: "loading" });
    try {
      setState({ s: "done", r: await fetchReading(chart) });
    } catch (e) {
      setState({ s: "error", msg: e instanceof Error ? e.message : "Не удалось получить толкование." });
    }
  }

  return (
    <article className={`r-card${state.s === "done" ? "" : " r-card--pending"}`} aria-busy={state.s === "loading"}>
      <h3 className="r-card__title">Толкование по книгам</h3>

      {state.s === "done" ? (
        <>
          <div className="reading">
            {state.r.segments.map((seg, i) => (
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
          {state.r.sources.length > 0 ? (
            <ol className="reading__sources">
              {state.r.sources.map((s) => (
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
          ) : (
            <p className="r-card__lead">В загруженных книгах прямых цитат к этой карте не нашлось — толкование дано по общим правилам традиции.</p>
          )}
        </>
      ) : (
        <>
          <p className="r-card__lead">
            Развёрнутый ответ на ваш вопрос: что показывает карта, когда ждать развязки и цитаты из классических
            книг, на которые опирается вывод. Составление занимает до минуты.
          </p>
          {state.s === "error" && <p className="field__error">{state.msg}</p>}
          <div>
            <button type="button" className="btn btn-sm" onClick={load} disabled={state.s === "loading"}>
              {state.s === "loading" ? "Читаем книги…" : state.s === "error" ? "Попробовать ещё раз" : "Получить толкование"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
