"use client";

import { useEffect, useRef, useState } from "react";
import HoraryResult from "@/components/HoraryResult";
import CityPicker from "@/components/CityPicker";
import { ROMAN, castChart, localParts, zonedToDate } from "@/lib/astro";
import { DEFAULT_PLACE, type Place } from "@/lib/geo";
import type { ChartRequest } from "@/lib/api";
import { type Judgement, judge } from "@/lib/judgement";
import { CATEGORIES, HOUSE_MEANINGS, findTopic } from "@/lib/topics";

/**
 * The calculator: what the question is about, when it was asked, where —
 * then the chart. Every field lives in the URL once the chart is built, so a
 * link to a chart opens the same chart.
 */

type Moment = { day: string; month: string; year: string; hour: string; minute: string };

const MOMENT_FIELDS: { key: keyof Moment; label: string; min: number; max: number }[] = [
  { key: "day", label: "День", min: 1, max: 31 },
  { key: "month", label: "Месяц", min: 1, max: 12 },
  { key: "year", label: "Год", min: 1900, max: 2100 },
  { key: "hour", label: "Час", min: 0, max: 23 },
  { key: "minute", label: "Минута", min: 0, max: 59 },
];

const CUSTOM = "custom";

function momentNow(tz: string): Moment {
  const p = localParts(new Date(), tz);
  return {
    day: String(p.day),
    month: String(p.month),
    year: String(p.year),
    hour: String(p.hour),
    minute: String(p.minute),
  };
}

export type Built = {
  judgement: Judgement;
  title: string;
  place: Place;
  question: string;
  wall: Moment;
  /** The inputs of this chart, as the API takes them. */
  request: ChartRequest;
};

/** The free-text question field is a v2 feature; off until then. */
const QUESTION_FIELD = false;

export default function HoraryApp({ mainSite }: { mainSite: string }) {
  const [openCat, setOpenCat] = useState<string>(CATEGORIES[0].id);
  const [selected, setSelected] = useState<{ category: string; topic: string } | null>(null);
  const [customHouse, setCustomHouse] = useState("7");
  const [question, setQuestion] = useState("");
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [moment, setMoment] = useState<Moment>({ day: "", month: "", year: "", hour: "", minute: "" });
  // Until the asker types a time, the moment follows the clock of whichever
  // city is chosen — "now" in Tashkent is not "now" in Moscow.
  const [momentAuto, setMomentAuto] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [built, setBuilt] = useState<Built | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const scrollOnBuild = useRef(false);

  function build(sel: { category: string; topic: string }, house: number, pl: Place, m: Moment, q: string) {
    const date = zonedToDate(+m.year, +m.month, +m.day, +m.hour, +m.minute, pl.tz);
    const chart = castChart(date, pl.lat, pl.lng, pl.tz);
    const found = findTopic(sel.category, sel.topic);
    const title = found ? found.topic.title : `Вопрос к ${ROMAN[house - 1]} дому`;
    const request: ChartRequest = {
      category: sel.category,
      topic: sel.topic,
      house,
      year: +m.year,
      month: +m.month,
      day: +m.day,
      hour: +m.hour,
      minute: +m.minute,
      lat: pl.lat,
      lng: pl.lng,
      tz: pl.tz,
      city: pl.label,
      question: q,
    };
    setBuilt({ judgement: judge(chart, house, found?.topic.natural ?? null), title, place: pl, question: q, wall: m, request });
  }

  // A shared link opens straight on its chart; a bare visit starts the clock
  // at the present minute in the default city.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const pl: Place | null =
      sp.get("lat") && sp.get("lng") && sp.get("tz")
        ? { label: sp.get("city") ?? "", lat: +sp.get("lat")!, lng: +sp.get("lng")!, tz: sp.get("tz")! }
        : null;
    const m: Moment = {
      day: sp.get("day") ?? "",
      month: sp.get("month") ?? "",
      year: sp.get("year") ?? "",
      hour: sp.get("hour") ?? "",
      minute: sp.get("minute") ?? "",
    };
    const cat = sp.get("category");
    const top = sp.get("topic");
    const house = sp.get("house");
    const q = sp.get("q") ?? "";
    const sel = cat && top ? { category: cat, topic: top } : null;
    const houseNo = sel?.topic === CUSTOM ? Number(house) : sel ? findTopic(sel.category, sel.topic)?.topic.house : undefined;

    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once on mount */
    if (pl) setPlace(pl);
    if (q) setQuestion(q);
    if (house) setCustomHouse(house);
    if (sel) {
      setSelected(sel);
      setOpenCat(sel.category);
    }
    const complete = MOMENT_FIELDS.every((f) => m[f.key] !== "");
    setMoment(complete ? m : momentNow((pl ?? DEFAULT_PLACE).tz));
    setMomentAuto(!complete);
    if (sel && pl && complete && houseNo && houseNo >= 1 && houseNo <= 12) {
      scrollOnBuild.current = true;
      build(sel, houseNo, pl, m, q);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (built && scrollOnBuild.current) {
      scrollOnBuild.current = false;
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [built]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!selected) next.topic = "Выберите, о чём вопрос: по теме определяется дом.";
    for (const f of MOMENT_FIELDS) {
      const v = Number(moment[f.key]);
      if (moment[f.key] === "" || !Number.isInteger(v) || v < f.min || v > f.max) {
        next.moment = "Проверьте дату и время: день 1–31, месяц 1–12, час 0–23, минута 0–59.";
      }
    }
    if (!next.moment) {
      const back = localParts(zonedToDate(+moment.year, +moment.month, +moment.day, 12, 0, place.tz), place.tz);
      if (back.day !== +moment.day) next.moment = "Такой даты нет в календаре.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(next.topic ? "step-topic" : "step-moment")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const sel = selected!;
    const house = sel.topic === CUSTOM ? Number(customHouse) : findTopic(sel.category, sel.topic)!.topic.house;
    const sp = new URLSearchParams({
      category: sel.category,
      topic: sel.topic,
      ...(sel.topic === CUSTOM ? { house: customHouse } : {}),
      ...moment,
      city: place.label,
      lat: String(place.lat),
      lng: String(place.lng),
      tz: place.tz,
      ...(question.trim() ? { q: question.trim() } : {}),
    });
    window.history.replaceState(null, "", `?${sp.toString()}#result`);
    scrollOnBuild.current = true;
    build(sel, house, place, moment, question.trim());
  }

  const isSelected = (category: string, topic: string) =>
    selected?.category === category && selected.topic === topic;

  return (
    <>
      <form className="steps-form" onSubmit={submit} noValidate>
        <section className="step-card" id="step-topic" aria-labelledby="step-topic-title">
          <h3 className="step-card__title" id="step-topic-title">
            <span>1.</span> О чём вопрос?
          </h3>
          <p className="step-card__lead">
            В хораре у каждой темы свой дом. Выберите тему — дом того, о чём вы спрашиваете, мы возьмём сами.
          </p>
          {errors.topic && <p className="field__error">{errors.topic}</p>}

          <div className="cats">
            {CATEGORIES.map((cat) => {
              const open = openCat === cat.id;
              return (
                <div key={cat.id} className={`cat${open ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="cat__head"
                    aria-expanded={open}
                    aria-controls={`cat-${cat.id}`}
                    onClick={() => setOpenCat(open ? "" : cat.id)}
                  >
                    <span>{cat.title}</span>
                    {selected?.category === cat.id && !open && <span className="cat__picked">выбрано</span>}
                    <span className="cat__chev" aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="cat__body" id={`cat-${cat.id}`}>
                      <p className="cat__intro">{cat.intro}</p>
                      <div role="radiogroup" aria-label={cat.title} className="topic-list">
                        {cat.topics.map((t) => (
                          <label key={t.id} className={`topic${isSelected(cat.id, t.id) ? " is-active" : ""}`}>
                            <input
                              type="radio"
                              name="topic"
                              checked={isSelected(cat.id, t.id)}
                              onChange={() => setSelected({ category: cat.id, topic: t.id })}
                            />
                            <span className="topic__body">
                              <span className="topic__title">{t.title}</span>
                              <span className="topic__text">{t.text}</span>
                              <span className="house-badge">
                                {ROMAN[t.house - 1]} дом — {HOUSE_MEANINGS[t.house]}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className={`cat${openCat === CUSTOM ? " is-open" : ""}`}>
              <button
                type="button"
                className="cat__head"
                aria-expanded={openCat === CUSTOM}
                onClick={() => setOpenCat(openCat === CUSTOM ? "" : CUSTOM)}
              >
                <span>Другое — выбрать дом самому</span>
                {selected?.topic === CUSTOM && openCat !== CUSTOM && <span className="cat__picked">выбрано</span>}
                <span className="cat__chev" aria-hidden="true" />
              </button>
              {openCat === CUSTOM && (
                <div className="cat__body">
                  <p className="cat__intro">Если вы знаете, к какому дому относится вопрос, укажите его номер.</p>
                  <label className={`topic${selected?.topic === CUSTOM ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name="topic"
                      checked={selected?.topic === CUSTOM}
                      onChange={() => setSelected({ category: CUSTOM, topic: CUSTOM })}
                    />
                    <span className="topic__body">
                      <span className="topic__title">Дом квезита</span>
                      <select
                        className="input input--inline"
                        value={customHouse}
                        aria-label="Номер дома"
                        onChange={(e) => {
                          setCustomHouse(e.target.value);
                          setSelected({ category: CUSTOM, topic: CUSTOM });
                        }}
                      >
                        {ROMAN.map((r, i) => (
                          <option key={r} value={i + 1}>
                            {r} — {HOUSE_MEANINGS[i + 1]}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* v2: «Ваш вопрос своими словами» — hidden until v2 (see docs/ROADMAP.md). */}
          {QUESTION_FIELD && (
          <div className="field">
            <label htmlFor="question" className="field__label">
              Ваш вопрос своими словами <span className="field__optional">— необязательно</span>
            </label>
            <textarea
              id="question"
              className="input input--area"
              rows={2}
              maxLength={300}
              placeholder="Например: напишет ли мне Андрей до конца недели?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <span className="field__hint">Пригодится для толкования по книгам — на вычисление карты не влияет.</span>
          </div>
          )}
        </section>

        <section className="step-card" id="step-moment" aria-labelledby="step-moment-title">
          <h3 className="step-card__title" id="step-moment-title">
            <span>2.</span> Момент вопроса
          </h3>
          <p className="step-card__lead">
            Минута, когда вы решили спросить, а не когда тема впервые пришла в голову. Время — местное для города
            из шага 3.
          </p>
          <div className="moment-row">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => {
                setMoment(momentNow(place.tz));
                setMomentAuto(true);
              }}>
              Сейчас
            </button>
            <span className="field__hint">или укажите точный момент:</span>
          </div>
          <div className="moment-grid">
            {MOMENT_FIELDS.map((f) => (
              <label key={f.key} className="field">
                <span className="field__label">{f.label}</span>
                <input
                  className="input input--num"
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={moment[f.key]}
                  aria-invalid={!!errors.moment}
                  onChange={(e) => {
                    setMoment((m) => ({ ...m, [f.key]: e.target.value }));
                    setMomentAuto(false);
                  }}
                />
              </label>
            ))}
          </div>
          {errors.moment && <p className="field__error">{errors.moment}</p>}
        </section>

        <section className="step-card" aria-labelledby="step-place-title">
          <h3 className="step-card__title" id="step-place-title">
            <span>3.</span> Место
          </h3>
          <p className="step-card__lead">
            Город, где вы находитесь в момент вопроса: по нему считаются дома карты и часовой пояс.
          </p>
          <CityPicker
            value={place}
            onChange={(p) => {
              setPlace(p);
              if (momentAuto) setMoment(momentNow(p.tz));
            }}
          />
        </section>

        <div className="steps-form__submit">
          <button type="submit" className="btn">
            Построить хорар
          </button>
        </div>
      </form>

      <div ref={resultRef} id="result" className="result-anchor">
        {built && <HoraryResult built={built} mainSite={mainSite} />}
      </div>
    </>
  );
}
