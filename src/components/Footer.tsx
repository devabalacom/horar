// TODO: the legal entity, INN and policy links of whoever runs this site.
export default function Footer({ mainSite }: { mainSite: string }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <h3>Астро AI</h3>
      </div>

      <div className="footer-bottom">
        <div className="footer-links">
          <div className="footer-link-area">
            <p>Хорарная астрология</p>
            <p>по классическим книгам</p>
          </div>

          <div className="footer-link-area">
            <a href={`${mainSite}/rules/privacy-policy`}>Политика конфиденциальности</a>
            <a href={`${mainSite}/rules/personal-data-policy`}>Политика персональных данных</a>
          </div>

          <div className="footer-link-area">
            <a href={`${mainSite}/rules/oferta`}>Публичный договор-оферта</a>
          </div>
        </div>

        <a href="mailto:info@aiastro.ru" className="footer-email">
          info@aiastro.ru
        </a>
      </div>
    </footer>
  );
}
