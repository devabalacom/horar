import { Suspense } from "react";
import CloudDivider from "@/components/CloudDivider";
import HoraryApp from "@/components/HoraryApp";
import { BOOKS, FAQ, STEPS } from "@/lib/content";
import { mainSiteUrl } from "@/lib/site";

const BEIGE = "#fbf2e1";

export default function HoraryHome() {
  const mainSite = mainSiteUrl();

  return (
    <>
      <section className="hero">
        <div className="container container--narrow hero__inner">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <span className="breadcrumbs__item">
              <a href={mainSite}>Главная</a>
              <span className="breadcrumbs__sep">/</span>
            </span>
            <span className="breadcrumbs__item">Хорарная карта</span>
          </nav>
          <h1>Хорарная астрология</h1>
          <p className="hero__lead">
            Карта неба на минуту, когда у вас возник вопрос: вернётся ли, получится ли, стоит ли. Традиция
            отвечает «да», «нет» или «да, но» — и мы показываем, из чего складывается этот ответ.
          </p>

          <div className="intro">
            <details className="faq__item" open>
              <summary>Что такое хорарная астрология?</summary>
              <div className="intro__body">
                <p>
                  Хорар (от лат. <em>hora</em> — «час») — раздел традиционной астрологии, где карта строится не на
                  момент рождения, а на момент, когда сформировался конкретный вопрос. Минута, в которую мысль
                  созрела, уже несёт в себе небо, способное ответить.
                </p>
                <p>
                  Методу больше тысячи лет: им пользовались арабские астрологи IX века и Гвидо Бонатти, а в 1647
                  году Уильям Лилли собрал правила в «Christian Astrology», по которой хорар читают до сих пор.
                  Хорар не предсказывает будущее «вообще» — он отвечает на один вопрос.
                </p>
              </div>
            </details>
            <details className="faq__item" id="how">
              <summary>Как это работает — шесть шагов</summary>
              <ol className="intro__steps">
                {STEPS.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}.</strong> {s.text}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </div>
      </section>

      <CloudDivider fill={BEIGE} />

      <section id="ask" className="band band--beige">
        <div className="container container--narrow">
          <Suspense>
            <HoraryApp mainSite={mainSite} />
          </Suspense>
        </div>
      </section>

      <CloudDivider fill={BEIGE} flip />

      <section id="books" className="band">
        <div className="container">
          <div className="section-head">
            <h2>Источники</h2>
            <p>
              Толкования опираются на пять классических книг по хорарной астрологии, переведённых в цифровой
              формат. Ответ будет показывать, из какой главы взято правило.
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
              Построить хорар
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
