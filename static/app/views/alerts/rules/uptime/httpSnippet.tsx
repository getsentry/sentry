import {useState} from 'react';
import styled from '@emotion/styled';
import {generateSentryTraceHeader} from '@sentry/utils';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';
import {safeURL} from 'sentry/utils/url/safeURL';

interface Props {
  body: string | null;
  headers: Array<[key: string, value: string]>;
  method: string;
  url: string;
}

export function HTTPSnippet({body, headers, method, url}: Props) {
  const [exampleTrace] = useState(() =>
    generateSentryTraceHeader(undefined, undefined, true)
  );

  const urlObject = safeURL(url);

  if (urlObject === undefined) {
    return null;
  }

  const pathname = urlObject.search
    ? `${urlObject.pathname}${urlObject.search}`
    : urlObject.pathname;

  const appendedBody = body ? `\r\n${body}` : '';
  const additionaLheaders = [...headers, ['Sentry-Trace', exampleTrace]];

  if (appendedBody !== '') {
    additionaLheaders.push(['Content-Size', new Blob([appendedBody]).size.toString()]);
  }

  const joinedHeaders =
    additionaLheaders.map(([key, value]) => `${key}: ${value}`).join('\r\n') + '\r\n';

  const request = `${method} ${pathname} HTTP/1.1\r\nHost: ${urlObject.host}\r\n${joinedHeaders}${appendedBody}`;

  return (
    <MaxSizedSnippet filename={t('Expected Check Request')} language="http">
      {request}
    </MaxSizedSnippet>
  );
}

const MaxSizedSnippet = styled(CodeSnippet)`
  pre {
    overflow-y: scroll;
    max-height: 400px;
  }
`;
