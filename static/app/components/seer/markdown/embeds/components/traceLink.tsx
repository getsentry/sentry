import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export function TraceLink({traceId, timestamp, spanId}: EmbedOutput<'trace'>) {
  const organization = useOrganization();
  const pathname = makeTracesPathname({
    organization,
    path: `/trace/${traceId}/`,
  });

  // Seer reports ISO timestamps but the waterfall reads unix seconds. Without
  // one it falls back to scanning a default window, so pass it through whenever
  // Seer knows when the trace happened.
  const href = queryString.stringifyUrl({
    url: pathname,
    query: {
      timestamp: getTimeStampFromTableDateField(timestamp),
      node: spanId ? `span-${spanId}` : undefined,
    },
  });

  return (
    <ResourceLink
      icon={IconSpan}
      href={href}
      title={t('Trace %s', getShortEventId(traceId))}
    />
  );
}
