import {type MouseEvent, useContext} from 'react';
import {stringifyUrl, type UrlObject} from 'query-string';

import {AnalyticsContext} from 'sentry/components/devtoolbar/components/analyticsProvider';

import useConfiguration from '../hooks/useConfiguration';
import {inlineLinkCss} from '../styles/link';

interface Props {
  children: React.ReactNode;
  to: UrlObject;
  onClick?: (event: MouseEvent) => void;
}

/**
 * Inline link to orgSlug.sentry.io/{to} with built-in click analytic.
 */
export default function SentryAppLink({children, to}: Props) {
  const {organizationSlug, trackAnalytics} = useConfiguration();
  const {eventName, eventKey} = useContext(AnalyticsContext);

  const url = stringifyUrl({
    url: `https://${organizationSlug}.sentry.io${to.url}`,
    query: to.query,
  });

  return (
    <a
      css={inlineLinkCss}
      href={url}
      onClick={() => {
        trackAnalytics?.({
          eventKey: eventKey + '.click',
          eventName: eventName + ' clicked',
        });
      }}
      rel="noreferrer noopener"
      target="_blank"
    >
      {children}
    </a>
  );
}
