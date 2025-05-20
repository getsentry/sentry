import {useMemo} from 'react';

import type {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import type {EventTransaction} from 'sentry/types/event';
import {useApiQueries} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {TRACE_FORMAT_PREFERENCE_KEY} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';

import type {ConnectedTraceConnection} from './traceLinkNavigationButton';

/**
 *  A temporary solution for getting "next trace" data.
 *  As traces currently only include information about the previous trace, the next trace is obtained by
 *  getting all root spans in a certain timespan (e.g. 1h) and searching the root span which has the
 *  current trace as it's "previous trace".
 */
export function useFindNextTrace({
  direction,
  currentTraceID,
  linkedTraceStartTimestamp,
  linkedTraceEndTimestamp,
  projectID,
}: {
  direction: ConnectedTraceConnection;
  currentTraceID?: string;
  linkedTraceEndTimestamp?: number;
  linkedTraceStartTimestamp?: number;
  projectID?: string;
}): TraceContextType | undefined {
  const {data: indexedSpans} = useSpansIndexed(
    {
      limit: direction === 'next' && projectID ? 100 : 1,
      noPagination: true,
      pageFilters: {
        projects: projectID ? [Number(projectID)] : [],
        environments: [],
        datetime: {
          period: null,
          utc: null,
          start: linkedTraceStartTimestamp
            ? new Date(linkedTraceStartTimestamp * 1000).toISOString()
            : null,
          end: linkedTraceEndTimestamp
            ? new Date(linkedTraceEndTimestamp * 1000).toISOString()
            : null,
        },
      },
      search: MutableSearch.fromQueryObject({is_transaction: 1}),
      fields: [
        SpanIndexedField.TRANSACTION_ID,
        SpanIndexedField.PROJECT_ID,
        SpanIndexedField.PROJECT,
      ],
    },
    'api.trace-view.linked-traces'
  );

  const traceData = indexedSpans.map(span => ({
    projectSlug: span.project,
    eventId: span['transaction.id'],
  }));

  const rootEvents = useTraceRootEvents(traceData);

  const nextTrace = rootEvents.find(rootEvent => {
    const traceContext = rootEvent.data?.contexts?.trace;
    const hasMatchingLink = traceContext?.links?.some(
      link =>
        link.attributes?.['sentry.link.type'] === `previous_trace` &&
        link.trace_id === currentTraceID
    );

    return hasMatchingLink;
  });

  return nextTrace?.data?.contexts.trace;
}

// Similar to `useTraceRootEvent` but allows fetching data for "more than one" trace data
function useTraceRootEvents(
  traceData: Array<{eventId?: string; projectSlug?: string}> | null
) {
  const organization = useOrganization();
  const [storedTraceFormat] = useSyncedLocalStorageState(
    TRACE_FORMAT_PREFERENCE_KEY,
    'non-eap'
  );

  const queryKeys = useMemo(() => {
    if (!traceData) {
      return [];
    }

    return traceData.map(
      trace =>
        [
          `/organizations/${organization.slug}/events/${trace?.projectSlug}:${trace.eventId}/`,
          {query: {referrer: 'trace-details-summary'}},
        ] as const
    );
  }, [traceData, organization.slug]);

  return useApiQueries<EventTransaction>(queryKeys, {
    // 10 minutes
    staleTime: 1000 * 60 * 10,
    enabled:
      Array.isArray(traceData) && traceData.length > 0 && storedTraceFormat === 'non-eap',
  });
}
