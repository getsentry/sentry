import {t} from 'sentry/locale';

export function TtfbDescription() {
  return (
    <div>
      <h3>{t('Time To First Byte (TTFB)')}</h3>
      <p>
        {t(
          `Time to First Byte (TTFB) is a foundational metric for measuring connection setup time and web server responsiveness in both the lab and the field. It helps identify when a web server is too slow to respond to requests. In the case of navigation requests—that is, requests for an HTML document—it precedes every other meaningful loading performance metric.`
        )}
      </p>
      <p>
        <a href="https://web.dev/ttfb/" target="_blank" rel="noreferrer">
          {t('Learn more about TTFB')}
        </a>
      </p>
    </div>
  );
}
