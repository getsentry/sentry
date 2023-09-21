import {t} from 'sentry/locale';

export function FidDescription() {
  return (
    <div>
      <h3>{t('First Input Delay (FID)')}</h3>
      <p>
        {t(
          `First Input Delay (FID) is the stable Core Web Vital metric for measuring load responsiveness because it quantifies the experience users feel when trying to interact with unresponsive pages—a low FID helps ensure that the page is usable. FID will be replaced by Interaction to Next Paint (INP) as a Core Web Vital in March 2024.`
        )}
      </p>
      <p>
        <a href="https://web.dev/fid/" target="_blank" rel="noreferrer">
          {t('Learn more about FID')}
        </a>
      </p>
    </div>
  );
}
