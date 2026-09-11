import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export function getTraceHref(
  {
    traceId,
    timestamp,
    spanId,
  }: Pick<EmbedOutput<'trace'>, 'traceId' | 'timestamp' | 'spanId'>,
  organization: Organization
): string {
  const pathname = makeTracesPathname({
    organization,
    path: `/trace/${traceId}/`,
  });

  // Seer reports ISO timestamps but the waterfall reads unix seconds. Without
  // one it falls back to scanning a default window, so pass it through whenever
  // Seer knows when the trace happened.
  return queryString.stringifyUrl({
    url: pathname,
    query: {
      timestamp: getTimeStampFromTableDateField(timestamp),
      node: spanId ? `span-${spanId}` : undefined,
    },
  });
}

export function TraceLink(props: EmbedOutput<'trace'>) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconSpan}
      href={getTraceHref(props, organization)}
      title={t('Trace %s', getShortEventId(props.traceId))}
    />
  );
}
