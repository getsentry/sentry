import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {generateSentryTraceHeader} from '@sentry/core';

import {CodeBlock} from 'sentry/components/core/code';
import {t} from 'sentry/locale';
import {safeURL} from 'sentry/utils/url/safeURL';

interface Props {
  body: string | null;
  headers: Array<[key: string, value: string]>;
  method: string;
  traceSampling: boolean;
  url: string;
}

export function HTTPSnippet({body, headers, method, url, traceSampling}: Props) {
  const [selectedTab, setSelectedTab] = useState('http');

  const exampleTrace = useMemo(
    () =>
      generateSentryTraceHeader(undefined, undefined, traceSampling ? undefined : false),
    [traceSampling]
  );

  const urlObject = safeURL(url);

  if (urlObject === undefined) {
    return null;
  }

  const pathname = urlObject.search
    ? `${urlObject.pathname}${urlObject.search}`
    : urlObject.pathname;

  const appendedBody = body ? `\r\n${body}` : '';
  const additionaLheaders: Array<[string, string]> = [
    ...headers,
    [
      'User-Agent',
      'SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)',
    ],
  ];

  if (exampleTrace) {
    additionaLheaders.push(['Sentry-Trace', exampleTrace]);
  }

  if (appendedBody) {
    additionaLheaders.push(['Content-Size', new Blob([appendedBody]).size.toString()]);
  }

  const joinedHeaders =
    additionaLheaders.map(([key, value]) => `${key}: ${value}`).join('\r\n') + '\r\n';

  const httpRequest = `${method} ${pathname} HTTP/1.1\r\nHost: ${urlObject.host}\r\n${joinedHeaders}${appendedBody}`;

  const headerArgs = additionaLheaders
    .map(([key, value]) => `-H "${key}: ${value.replace(/"/g, '\\"')}"`)
    .join(' \\\n  ');

  const bodyArg = body ? ` \\\n  -d '${body.replace(/'/g, "'\\''")}'` : '';
  const curlCommand = `curl -X ${method} \\\n  ${headerArgs}${bodyArg} \\\n  "${url}"`;

  return (
    <MaxSizedSnippet
      language={selectedTab === 'http' ? 'http' : 'bash'}
      tabs={[
        {label: t('HTTP Request'), value: 'http'},
        {label: t('cURL Example'), value: 'curl'},
      ]}
      selectedTab={selectedTab}
      onTabClick={setSelectedTab}
    >
      {selectedTab === 'http' ? httpRequest : curlCommand}
    </MaxSizedSnippet>
  );
}

const MaxSizedSnippet = styled(CodeBlock)`
  pre {
    overflow-y: auto;
    max-height: 400px;
  }
`;
