import CloudDivider from "@/components/CloudDivider";
import HoraryForm from "@/components/HoraryForm";
import { BOOKS, FAQ, STEPS } from "@/lib/content";

const BEIGE = "#fbf2e1";

export default function HoraryHome() {
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <span className="eyebrow">Хорарная астрология</span>
          <h1>Ответ на ваш вопрос — по карте момента</h1>
          <p className="hero__lead">
            Задайте один вопрос, который волнует прямо сейчас. Мы построим карту неба на секунду, когда
            вы его задали, и прочитаем её по правилам классических книг — с указанием источников.
          </p>
          <div className="hero__actions">
            <a href="#ask" className="btn">
              Задать вопрос
            </a>
            <a href="#how" className="btn btn-outline">
              Как это работает
            </a>
          </div>
          <ul className="hero__facts">
            <li>
              <strong>Без даты рождения</strong>
              <span>Нужен только вопрос и момент</span>
            </li>
            <li>
              <strong>5 классических книг</strong>
              <span>В основе каждого толкования</span>
            </li>
            <li>
              <strong>Ответ с источниками</strong>
              <span>Ссылки на главы и правила</span>
            </li>
          </ul>
        </div>
      </section>

      <CloudDivider fill={BEIGE} />

      <section id="ask" className="band band--beige">
        <div className="container container--narrow">
          <div className="section-head">
            <h2>Задайте вопрос</h2>
            <p>Сформулируйте его так, как сказали бы астрологу, — коротко и по существу.</p>
          </div>
          <HoraryForm />
        </div>
      </section>

      <CloudDivider fill={BEIGE} flip />

      <section id="how" className="band">
        <div className="container">
          <div className="section-head">
            <h2>Как это работает</h2>
            <p>Хорар отвечает не на вопрос «кто я», а на вопрос «что будет с этим делом».</p>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <span className="step__n">{s.n}</span>
                <h3 className="step__title">{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CloudDivider fill={BEIGE} />

      <section id="books" className="band band--beige">
        <div className="container">
          <div className="section-head">
            <h2>Источники</h2>
            <p>
              Толкования опираются на пять классических книг по хорарной астрологии, переведённых в
              цифровой формат. Ответ всегда показывает, из какой главы взято правило.
            </p>
          </div>
          <ul className="books">
            {BOOKS.map((b) => (
              <li key={b.n} className="book">
                <span className="book__n">{b.n}</span>
                <h3 className="book__title">{b.title}</h3>
                <span className="book__author">{b.author}</span>
                <p>{b.about}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CloudDivider fill={BEIGE} flip />

      <section id="faq" className="band">
        <div className="container container--narrow">
          <div className="section-head">
            <h2>Вопросы и ответы</h2>
          </div>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q} className="faq__item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="faq__cta">
            <a href="#ask" className="btn">
              Задать свой вопрос
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
