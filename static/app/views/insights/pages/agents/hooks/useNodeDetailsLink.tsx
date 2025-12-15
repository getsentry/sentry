import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export function useNodeDetailsLink({
  node,
  traceSlug,
  source,
}: {
  node: AITraceSpanNode | undefined;
  source: TraceViewSources;
  traceSlug: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  let spanId: string | undefined;
  let targetId: string | undefined;
  let timestamp: number | undefined;

  if (node) {
    if (isEAPSpanNode(node)) {
      spanId = node.value.event_id;
      targetId = node.value.transaction_id;
      timestamp = node.value.start_timestamp;
    }
    if (isTransactionNode(node)) {
      spanId = node.value.event_id;
      targetId = node.value.event_id;
      timestamp = node.value.start_timestamp;
    }
    if (isSpanNode(node)) {
      spanId = node.value.span_id;
      timestamp = node.value.start_timestamp;
      // Find parent transaction
      let parent = node.parent;
      while (parent && !isTransactionNode(parent)) {
        parent = parent.parent;
      }
      if (parent) {
        targetId = parent.value.event_id;
        spanId = node.value.span_id;
      }
    }
  }

  return getTraceDetailsUrl({
    source,
    organization,
    location: {
      ...location,
      // Do not forward all query params to the trace view
      query: {},
    },
    traceSlug,
    spanId,
    targetId,
    timestamp,
    dateSelection: normalizeDateTimeParams(selection),
  });
}
