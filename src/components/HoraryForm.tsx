"use client";

import { useEffect, useRef, useState } from "react";
import HoraryWheel from "@/components/HoraryWheel";
import { type Chart, castChart } from "@/lib/astro";
import { type Judgement, judge } from "@/lib/judgement";
import { CITIES, EXAMPLES, TOPICS, type TopicId } from "@/lib/content";

const MIN_LENGTH = 10;
const MAX_LENGTH = 300;

const STAGES = ["Фиксируем момент вопроса", "Строим карту", "Ищем правила в книгах", "Формулируем ответ"];

type Result = { question: string; topic: TopicId; city: string; chart: Chart; judgement: Judgement };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** `YYYY-MM-DDTHH:mm` in local time, for <input type="datetime-local">. */
function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function HoraryForm() {
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [city, setCity] = useState<string>(CITIES[0].name);
  const [customTime, setCustomTime] = useState(false);
  const [timeValue, setTimeValue] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // The clock ticks on the client only, so the server never renders a time
  // that would mismatch on hydration.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const q = question.trim();
    if (q.length < MIN_LENGTH) next.question = "Сформулируйте вопрос полностью — хотя бы несколько слов.";
    if (!topic) next.topic = "Выберите тему — по ней определяется дом вопроса.";
    if (customTime && !timeValue) next.time = "Укажите дату и время вопроса.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = next.question ? "#question" : next.topic ? ".topics .tag" : "input[type=datetime-local]";
      document.querySelector<HTMLElement>(first)?.focus();
      return;
    }

    // The moment of a horary question is when it was asked: pressing the
    // button, unless the asker sets the time they first put it into words.
    const moment = customTime ? new Date(timeValue) : new Date();
    const place = CITIES.find((c) => c.name === city) ?? CITIES[0];
    const house = TOPICS.find((t) => t.id === topic)!.house;

    setResult(null);
    setStage(0);
    STAGES.forEach((_, i) => setTimeout(() => setStage(i), i * 650));
    setTimeout(() => {
      const chart = castChart(moment, place.lat, place.lon);
      setResult({ question: q, topic: topic!, city: place.name, chart, judgement: judge(chart, house) });
      setStage(null);
    }, STAGES.length * 650);
  }

  function reset() {
    setResult(null);
    setQuestion("");
    setTopic(null);
    document.getElementById("ask")?.scrollIntoView({ behavior: "smooth" });
  }

  const busy = stage !== null;

  return (
    <>
      <form className="ask-card" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="field">
          <label htmlFor="question" className="field__label">
            Ваш вопрос
          </label>
          <textarea
            id="question"
            className="input input--area"
            rows={3}
            maxLength={MAX_LENGTH}
            placeholder="Например: получу ли я работу, на которую прошёл собеседование?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={!!errors.question}
            aria-describedby="question-hint"
            disabled={busy}
          />
          <div className="field__row" id="question-hint">
            {errors.question ? (
              <span className="field__error">{errors.question}</span>
            ) : (
              <span className="field__hint">Один вопрос — одна тема. Чем конкретнее, тем точнее ответ.</span>
            )}
            <span className="field__count">
              {question.length}/{MAX_LENGTH}
            </span>
          </div>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="example" onClick={() => setQuestion(ex)} disabled={busy}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="field">
          <legend className="field__label">Тема</legend>
          <div className="topics" role="radiogroup">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={topic === t.id}
                className={`tag${topic === t.id ? " is-active" : ""}`}
                onClick={() => setTopic(t.id)}
                disabled={busy}
              >
                {t.label}
              </button>
            ))}
          </div>
          {errors.topic && <span className="field__error">{errors.topic}</span>}
        </fieldset>

        <div className="field-grid">
          <div className="field">
            <span className="field__label">Момент вопроса</span>
            {customTime ? (
              <input
                type="datetime-local"
                className="input"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                aria-label="Дата и время вопроса"
                aria-invalid={!!errors.time}
                disabled={busy}
              />
            ) : (
              <div className="moment" aria-live="off">
                <span className="moment__dot" aria-hidden="true" />
                {now ? dateFormat.format(now) : " "}
              </div>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.checked);
                  if (e.target.checked && !timeValue) setTimeValue(toLocalInput(new Date()));
                }}
                disabled={busy}
              />
              Вопрос возник раньше — указать время
            </label>
            {errors.time && <span className="field__error">{errors.time}</span>}
          </div>

          <div className="field">
            <label htmlFor="city" className="field__label">
              Где вы находитесь
            </label>
            <select id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} disabled={busy}>
              {CITIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
            <span className="field__hint">Нужно для расчёта домов карты.</span>
          </div>
        </div>

        <div className="ask-card__submit">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Строим карту…" : "Получить ответ"}
          </button>
          <span className="field__hint">Карта строится на секунду нажатия кнопки.</span>
        </div>

        {busy && (
          <ol className="stages" aria-live="polite">
            {STAGES.map((s, i) => (
              <li key={s} className={i < stage! ? "is-done" : i === stage ? "is-active" : ""}>
                {s}
              </li>
            ))}
          </ol>
        )}
      </form>

      {result && (
        <div ref={resultRef} className="result" id="result">
          <div className="result__head">
            <span className="result__eyebrow">Ваш вопрос</span>
            <h3 className="result__question">«{result.question}»</h3>
            <p className="result__meta">
              {dateFormat.format(result.chart.date)} · {result.city} ·{" "}
              {TOPICS.find((t) => t.id === result.topic)!.label}
            </p>
          </div>

          <div className="result__grid">
            <div className="result__chart">
              <HoraryWheel
                chart={result.chart}
                highlight={[result.judgement.querent, result.judgement.quesited ?? ""]}
              />
            </div>

            <div className="result__body">
              <div className={`verdict verdict--${result.judgement.verdict.tone}`}>
                <span className="verdict__label">Предварительный вывод</span>
                <h3 className="verdict__title">{result.judgement.verdict.title}</h3>
                <p>{result.judgement.verdict.text}</p>
              </div>

              <dl className="factors">
                {result.judgement.factors.map((f) => (
                  <div key={f.label} className="factor">
                    <dt>{f.label}</dt>
                    <dd>
                      <strong>{f.value}</strong>
                      {f.note && <span>{f.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>

              {result.judgement.considerations.length > 0 && (
                <div className="considerations">
                  <span className="considerations__title">Условия перед суждением</span>
                  <ul>
                    {result.judgement.considerations.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="reading">
            <h4 className="reading__title">Толкование по книгам</h4>
            <p className="reading__pending">
              Здесь появится развёрнутый ответ: что показывает карта, сроки и цитаты из глав книг, на которые
              опирается вывод. Подключаем на следующем этапе.
            </p>
            <div className="reading__sources" aria-hidden="true">
              <span className="source-chip">Книга I · гл. —</span>
              <span className="source-chip">Книга III · гл. —</span>
            </div>
          </div>

          <div className="result__actions">
            <button type="button" className="btn btn-outline" onClick={reset}>
              Задать новый вопрос
            </button>
          </div>
        </div>
      )}
    </>
  );
}
