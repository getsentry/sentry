import {t} from 'sentry/locale';

export function LcpDescription() {
  return (
    <div>
      <h3>{t('Largest Contentful Paint (LCP)')}</h3>
      <p>
        {t(
          `Largest Contentful Paint (LCP) is an important, stable Core Web Vital metric for measuring perceived load speed because it marks the point in the page load timeline when the page's main content has likely loaded—a fast LCP helps reassure the user that the page is useful.`
        )}
      </p>
      <p>
        <a href="https://web.dev/lcp/" target="_blank" rel="noreferrer">
          {t('Learn more about LCP')}
        </a>
      </p>
    </div>
  );
}
