import {t} from 'sentry/locale';

export function ClsDescription() {
  return (
    <div>
      <h3>{t('Cumulative Layout Shift (CLS)')}</h3>
      <p>
        {t(
          `Cumulative Layout Shift (CLS) is a stable Core Web Vital metric. It is an important, user-centric metric for measuring visual stability because it helps quantify how often users experience unexpected layout shifts—a low CLS helps ensure that the page is delightful.`
        )}
      </p>
      <p>
        <a href="https://web.dev/cls/" target="_blank" rel="noreferrer">
          {t('Learn more about CLS')}
        </a>
      </p>
    </div>
  );
}
