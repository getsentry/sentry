import {t} from 'sentry/locale';

export function FcpDescription() {
  return (
    <div>
      <h3>{t('First Contentful Paint (FCP)')}</h3>
      <p>
        {t(
          `First Contentful Paint (FCP) is an important, user-centric metric for measuring perceived load speed because it marks the first point in the page load timeline where the user can see anything on the screen—a fast FCP helps reassure the user that something is happening.`
        )}
      </p>
      <p>
        <a href="https://web.dev/fcp/" target="_blank" rel="noreferrer">
          {t('Learn more about FCP')}
        </a>
      </p>
    </div>
  );
}
