import {t} from 'sentry/locale';

export function TbtDescription() {
  return (
    <div>
      <h3>{t('Total Blocking Time (TBT)')}</h3>
      <p>
        {t(
          `Total Blocking Time (TBT) is an important lab metric for measuring load responsiveness because it helps quantify the severity of how non-interactive a page is prior to it becoming reliably interactive—a low TBT helps ensure that the page is usable.`
        )}
      </p>
      <p>
        <a href="https://web.dev/tbt/" target="_blank" rel="noreferrer">
          {t('Learn more about TBT')}
        </a>
      </p>
    </div>
  );
}
