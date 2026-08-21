import queryString from 'query-string';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSpan} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

import {EvidenceBoundary, EvidenceFrame, LazyEvidence} from './evidenceFrame';

type TraceLinkOutput = Extract<EmbedOutput<'trace'>, {traceId: string}>;

function TraceLink({traceId, timestamp, spanId}: TraceLinkOutput) {
  const organization = useOrganization();
  const pathname = makeTracesPathname({
    organization,
    path: `/trace/${traceId}/`,
  });
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

function getTraceRows(trace: TraceTree.Trace | undefined): string[] {
  if (!trace) {
    return [];
  }
  if (Array.isArray(trace)) {
    return trace.slice(0, 5).map(item => {
      if ('name' in item && item.name) {
        return `${item.op || item.event_type}: ${item.name}`;
      }
      return 'description' in item && item.description
        ? item.description
        : item.event_type;
    });
  }
  return [
    ...trace.transactions.slice(0, 5).map(item => item.transaction || item.event_id),
    ...trace.orphan_errors
      .slice(0, Math.max(0, 5 - trace.transactions.length))
      .map(item => item.title || item.event_id),
  ];
}

function getTraceItemCount(trace: TraceTree.Trace | undefined): number {
  if (!trace) {
    return 0;
  }
  return Array.isArray(trace)
    ? trace.length
    : trace.transactions.length + trace.orphan_errors.length;
}

function TraceEvidenceContent({traceId, spanId}: {traceId: string; spanId?: string}) {
  const organization = useOrganization();
  const query = useTrace({
    traceSlug: traceId,
    limit: 1000,
    referrer: 'seer.investigation.evidence',
  });
  const rows = getTraceRows(query.data);
  const itemCount = getTraceItemCount(query.data);
  const focusQuery = spanId ? `?node=${encodeURIComponent(`span-${spanId}`)}` : '';
  const href = `/organizations/${organization.slug}/traces/trace/${traceId}/${focusQuery}`;

  return (
    <EvidenceFrame
      title={t('Trace %s', traceId)}
      detail={
        query.data
          ? spanId
            ? t('Focused on span %s', spanId)
            : tn('%s trace item', '%s trace items', itemCount)
          : undefined
      }
      icon={IconSpan}
      href={href}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {query.data ? (
        rows.length ? (
          <TraceRows>
            {rows.map((row, index) => (
              <Text key={`${row}-${index}`} ellipsis>
                {row}
              </Text>
            ))}
          </TraceRows>
        ) : (
          <Text variant="muted">{t('No retained trace items were found.')}</Text>
        )
      ) : null}
    </EvidenceFrame>
  );
}

export const Trace = defineSeerEmbed({
  name: 'trace',
  render(props) {
    if ('traceId' in props) {
      return <TraceLink {...props} />;
    }
    return (
      <EvidenceBoundary>
        <LazyEvidence>
          <TraceEvidenceContent traceId={props.trace_id} spanId={props.span_id} />
        </LazyEvidence>
      </EvidenceBoundary>
    );
  },
});

const TraceRows = styled(Stack)`
  padding-left: ${p => p.theme.space.md};
  border-left: 2px solid ${p => p.theme.tokens.border.secondary};
`;
