"use client";

import { useState } from "react";
import HoraryWheel from "@/components/HoraryWheel";
import ReadingCard from "@/components/ReadingCard";
import { API_URL, sendFeedback } from "@/lib/api";
import type { Built } from "@/components/HoraryApp";
import { PLANETS, ROMAN, formatPosition } from "@/lib/astro";
import { describeState, viaList } from "@/lib/dignities";

const pad = (s: string) => s.padStart(2, "0");

const CAPTION: Record<string, string> = {
  yes: "Похоже на «да»",
  hard: "С оговоркой",
  no: "Похоже на «нет»",
  open: "Нужен разбор",
};

export default function HoraryResult({ built, mainSite }: { built: Built; mainSite: string }) {
  const { judgement: j, title, place, question, wall, request } = built;
  const { chart } = j;
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const castVote = (v: "up" | "down") => {
    setVote(v);
    // A lost vote is not worth bothering the visitor about.
    if (API_URL) sendFeedback(request, v).catch(() => {});
  };

  const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: chart.tz });
  const hours = (d: Date) => (d.getTime() - chart.date.getTime()) / 3600_000;

  const meta = [
    `${pad(wall.day)}.${pad(wall.month)}.${wall.year} ${pad(wall.hour)}:${pad(wall.minute)} (${chart.tz})`,
    place.label,
    `асцендент в ${formatPosition(chart.asc)}`,
    chart.isDay ? "карта дневная" : "карта ночная",
    j.moonWaxing ? "Луна растущая" : "Луна убывающая",
    chart.hourRuler ? `час ${PLANETS[chart.hourRuler].gen}` : null,
  ].filter(Boolean);

  const highlight = j.significators.map((s) => s.planet);

  return (
    <div className="result">
      {/* ---------- verdict ---------- */}
      <article className="r-card r-card--dark">
        <span className="r-eyebrow">Хорарная карта</span>
        <h2 className="r-title">«{title}»</h2>
        {question && <p className="r-question">{question}</p>}
        <p className="r-meta">{meta.join(" · ")}</p>

        <div className={`verdict verdict--${j.verdict.tone}`}>
          <span className="verdict__label">{CAPTION[j.verdict.tone]}</span>
          <h3 className="verdict__title">{j.verdict.title}</h3>
          <p>{j.verdict.text}</p>
          <p className="verdict__note">
            Это автоматическая сводка по главному аспекту и проверкам перед суждением. Рецепции, состояние
            планет и Луну смотрите в карточках ниже — читайте вывод вместе с ними.
          </p>
        </div>

        <div className="vote" aria-live="polite">
          {vote ? (
            <p>Спасибо! Ваш отзыв поможет сделать ответы точнее.</p>
          ) : (
            <>
              <p>Похоже на правду?</p>
              <div className="vote__buttons">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => castVote("up")}>
                  Похоже
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => castVote("down")}>
                  Мимо
                </button>
              </div>
            </>
          )}
        </div>
      </article>

      {/* ---------- reading from the books ---------- */}
      <ReadingCard key={JSON.stringify(request)} chart={request} />

      {/* ---------- wheel ---------- */}
      <article className="r-card">
        <h3 className="r-card__title">Карта хорара</h3>
        <p className="r-card__lead">
          Дома по Региомонтану на момент вопроса. Подсвечены сигнификаторы; линии в центре — аспекты в орбисе:
          зелёные гармоничные, терракотовые напряжённые.
        </p>
        <HoraryWheel chart={chart} highlight={highlight} grid={j.grid} />
      </article>

      {/* ---------- considerations ---------- */}
      <article className="r-card">
        <div className="r-card__head">
          <h3 className="r-card__title">Готова ли карта к суждению?</h3>
          <span className={`badge badge--${j.radical ? "ok" : "warn"}`}>
            {j.radical ? "радикальна" : "с оговорками"}
          </span>
        </div>
        <p className="r-card__lead">
          Традиционные проверки перед тем, как читать карту. Если всё в порядке, карта радикальна и работает в
          полную силу.
        </p>
        <ul className="checks">
          {j.considerations.map((c) => (
            <li key={c.title} className={`check-item check-item--${c.level}`}>
              <strong>{c.title}</strong>
              <p>{c.text}</p>
            </li>
          ))}
          {j.considerations.length === 0 && (
            <li className="check-item check-item--ok">
              <strong>Препятствий для суждения нет</strong>
              <p>Ни одно из классических условий не нарушено.</p>
            </li>
          )}
        </ul>
      </article>

      {/* ---------- significators ---------- */}
      <article className="r-card">
        <h3 className="r-card__title">Сигнификаторы</h3>
        <p className="r-card__lead">
          Главные действующие лица карты. Сила или слабость планеты переносится на то, что она обозначает.
        </p>
        <div className="sig-grid">
          {j.significators.map((s) => (
            <div key={s.role} className="sig">
              <span className="sig__role">{s.role}</span>
              <h4 className="sig__name">
                <span aria-hidden="true">{PLANETS[s.planet].glyph + "︎"}</span> {PLANETS[s.planet].name}
              </h4>
              <span className="sig__sub">{s.subtitle}</span>
              <dl className="sig__facts">
                <div>
                  <dt>Положение</dt>
                  <dd>{formatPosition(s.row.lon)}</dd>
                </div>
                <div>
                  <dt>Дом</dt>
                  <dd>{ROMAN[s.row.house - 1]}</dd>
                </div>
                <div>
                  <dt>Достоинства</dt>
                  <dd>{describeState(s.row.state)}</dd>
                </div>
                {s.row.statuses.length > 0 && (
                  <div>
                    <dt>Статус</dt>
                    <dd>{s.row.statuses.join(", ")}</dd>
                  </div>
                )}
              </dl>
              <span className="sig__sub-title">Принимается</span>
              <ul className="sig__rec">
                {s.row.state.receivedBy.map((r) => (
                  <li key={r.planet}>
                    <span>{PLANETS[r.planet].name}</span>
                    <span>{viaList(r.via)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {j.natural && (
          <p className="note">
            <strong>Натуральный сигнификатор темы — {PLANETS[j.natural].name}.</strong> Он показывает предмет
            вопроса по своей природе и читается вместе с управителем дома; его состояние — в таблице планет.
          </p>
        )}

        {j.reception && (
          <div className={`note note--rec note--${j.reception.strength}`}>
            <strong>
              {j.reception.strength === "strong"
                ? "Сильный взаимный приём между сигнификаторами"
                : j.reception.strength === "weak"
                  ? "Слабый взаимный приём между сигнификаторами"
                  : j.reception.strength === "one-way"
                    ? "Приём в одну сторону"
                    : "Приёма между сигнификаторами нет"}
            </strong>
            <p>
              {j.reception.aInB.length > 0 &&
                `${PLANETS[j.reception.a].name} стоит в достоинствах планеты ${PLANETS[j.reception.b].gen} (${viaList(j.reception.aInB)}). `}
              {j.reception.bInA.length > 0 &&
                `${PLANETS[j.reception.b].name} стоит в достоинствах планеты ${PLANETS[j.reception.a].gen} (${viaList(j.reception.bInA)}). `}
              {j.reception.strength === "strong" &&
                "Через обитель или экзальтацию: стороны расположены друг к другу, приём может помочь даже при трудном аспекте."}
              {j.reception.strength === "weak" &&
                "Через триплицитность, терм или лик: лёгкая взаимная симпатия, на вердикт почти не влияет."}
              {j.reception.strength === "none" && "Сигнификаторы не стоят в достоинствах друг друга."}
            </p>
          </div>
        )}
      </article>

      {/* ---------- main aspect ---------- */}
      {j.main && (
        <article className="r-card">
          <h3 className="r-card__title">Главный аспект</h3>
          <p className="r-card__lead">
            Аспект между сигнификаторами спрашивающего и вопроса. Сходящийся говорит, что событие складывается;
            расходящийся — что момент прошёл.
          </p>
          <div className="aspect-box">
            <p className="aspect-box__pair">
              {PLANETS[j.main.a].name} · {j.main.now?.aspect.name ?? j.main.course.perfection?.aspect.name ?? "нет аспекта"} ·{" "}
              {PLANETS[j.main.b].name}
            </p>
            <p className="aspect-box__meta">
              {j.main.now
                ? `Орбис ${j.main.now.orb.toFixed(1).replace(".", ",")}° · ${j.main.now.applying ? "сходящийся" : "расходящийся"}`
                : "Сейчас вне орбиса"}
              {j.main.timing && ` · срок ${j.main.timing}`}
            </p>
            {j.main.course.refranation && (
              <p className="aspect-box__warn">
                Рефранация: одна из планет разворачивается раньше, чем аспект становится точным. Дело подходит к
                завершению, но не складывается.
              </p>
            )}
            <div className="sky">
              <span className="sky__title">Небо по дням</span>
              <ol>
                <li>
                  <span>сейчас</span>
                  <span>
                    {j.main.now
                      ? `${PLANETS[j.main.a].name} и ${PLANETS[j.main.b].name}: ${j.main.now.aspect.name}, до точного ${j.main.now.orb.toFixed(1).replace(".", ",")}°`
                      : `${PLANETS[j.main.a].name} и ${PLANETS[j.main.b].name} не в аспекте`}
                  </span>
                </li>
                {j.main.course.events.map((ev, i) => (
                  <li key={i} className={`sky__ev sky__ev--${ev.tone}`}>
                    <span>{hours(ev.date) < 48 ? `через ${Math.round(hours(ev.date))} ч` : dayMonth.format(ev.date)}</span>
                    <span>{ev.text}</span>
                  </li>
                ))}
                {!j.main.course.perfection && (
                  <li className="sky__ev sky__ev--bad">
                    <span>дальше</span>
                    <span>точного аспекта до смены знака нет</span>
                  </li>
                )}
              </ol>
              <p className="sky__note">
                Посчитано по эфемериде от момента вопроса, время местное. Это движение планет, а не дата события.
              </p>
            </div>
          </div>
          <p className="note note--plain">
            <strong>Следующий аспект Луны: </strong>
            {j.moonNext
              ? `${j.moonNext.aspect.name} с планетой ${PLANETS[j.moonNext.planet].gen}, точный через ${
                  hours(j.moonNext.date) < 24
                    ? `${Math.max(1, Math.round(hours(j.moonNext.date)))} ч`
                    : `${(hours(j.moonNext.date) / 24).toFixed(1).replace(".", ",")} сут`
                }. Это сценарий, по которому пойдёт дело.`
              : "до выхода из знака Луна не сделает точных аспектов — она без курса."}
          </p>
        </article>
      )}

      {/* ---------- planets ---------- */}
      <article className="r-card">
        <h3 className="r-card__title">Планеты в карте</h3>
        <p className="r-card__lead">
          Семь традиционных планет. Дом — по правилу Лилли: планета в пределах 5° до куспида следующего дома
          читается уже в нём.
        </p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Планеты в карте">
          <table className="planets">
            <thead>
              <tr>
                <th>Планета</th>
                <th>Положение</th>
                <th>Дом</th>
                <th>Достоинства</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {j.planets.map((p) => (
                <tr key={p.id} className={highlight.includes(p.id) ? "is-sig" : ""}>
                  <td>
                    <span aria-hidden="true">{PLANETS[p.id].glyph + "︎"}</span> {PLANETS[p.id].name}
                  </td>
                  <td>{formatPosition(p.lon)}</td>
                  <td>{ROMAN[p.house - 1]}</td>
                  <td>{describeState(p.state)}</td>
                  <td>
                    {p.statuses.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* ---------- next steps on the main site ---------- */}
      <div className="cross">
        <a className="cross__card" href={`${mainSite}/natal`}>
          <span className="r-eyebrow">Натальная карта</span>
          <h3>Хорар ответил на вопрос. А кто его задаёт?</h3>
          <p>Хорар видит одну минуту и одну тему. Почему вас держит именно этот вопрос, покажет карта рождения.</p>
          <span className="btn btn-sm">Рассчитать натальную карту</span>
        </a>
        <a className="cross__card" href={`${mainSite}/compatibility`}>
          <span className="r-eyebrow">Совместимость</span>
          <h3>А что между вами двумя?</h3>
          <p>Как вы устроены как пара и где искрит — покажет сравнение двух карт рождения.</p>
          <span className="btn btn-sm">Проверить совместимость</span>
        </a>
      </div>

      <p className="disclaimer">
        Хорарная астрология — традиция со своими правилами, а не точная наука. Расчёт делает то же, что
        астролог-классик: находит сигнификаторов, аспекты и состояния планет по канону Лилли и складывает из
        них предположение. Решение остаётся за вами. Информация носит информационно-развлекательный характер и
        не заменяет медицинскую, юридическую или психологическую помощь.
      </p>
    </div>
  );
}
