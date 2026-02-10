import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
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

  const spanId: string | undefined = node?.id;
  const targetId: string | undefined = node?.transactionId;
  const timestamp: number | undefined = node?.startTimestamp;

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
