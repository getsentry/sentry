import type {MouseEvent} from 'react';
import {stringifyUrl, type UrlObject} from 'query-string';

import useConfiguration from '../hooks/useConfiguration';
import {inlineLinkCss} from '../styles/link';

interface Props {
  children: React.ReactNode;
  to: UrlObject;
  onClick?: (event: MouseEvent) => void;
}

export default function SentryAppLink({children, to, onClick}: Props) {
  const {organizationSlug} = useConfiguration();

  const url = stringifyUrl({
    url: `https://${organizationSlug}.sentry.io${to.url}`,
    query: to.query,
  });

  return (
    <a
      css={inlineLinkCss}
      onClick={onClick}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  );
}
