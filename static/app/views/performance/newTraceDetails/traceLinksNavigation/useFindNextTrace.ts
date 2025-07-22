import {useMemo} from 'react';

import type {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {EventTransaction} from 'sentry/types/event';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQueries, useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {useIsEAPTraceEnabled} from 'sentry/views/performance/newTraceDetails/useIsEAPTraceEnabled';

import type {ConnectedTraceConnection} from './traceLinkNavigationButton';

interface TraceResults {
  data: TraceResult[];
  meta: any;
}

/**
 * Updated solution for getting "next trace" data using the same endpoint and query mechanism
 * as the explore view. This uses the /traces/ endpoint with EAP dataset for better performance
 * and consistency.
 */
export function useFindNextTrace({
  direction,
  currentTraceID,

  // currentSpanId,
  linkedTraceStartTimestamp,
  linkedTraceEndTimestamp,
  projectID,
}: {
  direction: ConnectedTraceConnection;
  currentSpanId?: string;
  currentTraceID?: string;
  linkedTraceEndTimestamp?: number;
  linkedTraceStartTimestamp?: number;
  projectID?: string;
}): TraceContextType | undefined {
  const organization = useOrganization();
  const isEAP = useIsEAPTraceEnabled();

  // Build query using MutableSearch like explore view does
  const query = useMemo(() => {
    const search = new MutableSearch('');

    // Only search in the specific project if provided
    if (projectID) {
      search.addFilterValue('project', projectID);
    }
    // search.addFilterValue('previous_trace', `${currentTraceID}-${currentSpanId}-1`);

    return search.formatString();
  }, [projectID]);

  // Use the same traces endpoint and patterns as explore view
  const tracesQuery = useApiQuery<TraceResults>(
    [
      `/organizations/${organization.slug}/traces/`,
      {
        query: {
          project: projectID ? [Number(projectID)] : [],
          environment: [],
          ...normalizeDateTimeParams({
            period: null,
            utc: null,
            start: linkedTraceStartTimestamp
              ? new Date(linkedTraceStartTimestamp * 1000).toISOString()
              : null,
            end: linkedTraceEndTimestamp
              ? new Date(linkedTraceEndTimestamp * 1000).toISOString()
              : null,
          }),
          dataset: DiscoverDatasets.SPANS_EAP,
          query,
          sort: '-timestamp',
          per_page: direction === 'next' ? 100 : 1,
          breakdownSlices: 40,
        },
      },
    ],
    {
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: false,
      enabled: Boolean(
        isEAP &&
          currentTraceID &&
          linkedTraceStartTimestamp &&
          linkedTraceEndTimestamp &&
          direction === 'next'
      ),
    }
  );

  // Extract potential trace data for root event fetching
  const traceData = useMemo(() => {
    if (!tracesQuery.data?.data) {
      return [];
    }

    return tracesQuery.data.data.map(trace => ({
      projectSlug: trace.project ?? undefined,
      eventId: undefined, // We'll need to find the root span event ID
      traceId: trace.trace,
    }));
  }, [tracesQuery.data]);

  // Fetch root events for traces to check for trace links
  const rootEvents = useTraceRootEvents(traceData);

  // Find the next trace based on trace links
  const nextTrace = useMemo(() => {
    const foundRootEvent = rootEvents.find(rootEvent => {
      const traceContext = rootEvent.data?.contexts?.trace;
      const hasMatchingLink = traceContext?.links?.some(
        link =>
          link.attributes?.['sentry.link.type'] === 'previous_trace' &&
          link.trace_id === currentTraceID
      );

      return hasMatchingLink;
    });

    return foundRootEvent?.data?.contexts.trace;
  }, [rootEvents, currentTraceID]);

  return nextTrace;
}

// Similar to `useTraceRootEvent` but allows fetching data for "more than one" trace data
function useTraceRootEvents(
  traceData: Array<{eventId?: string; projectSlug?: string; traceId?: string}> | null
) {
  const organization = useOrganization();
  const isEAP = useIsEAPTraceEnabled();

  const queryKeys = useMemo(() => {
    if (!traceData || isEAP) {
      return [];
    }

    // For now, we'll need to find root spans for each trace to get the event data
    // This is a limitation until we have a better way to get trace link data directly
    return traceData
      .filter(trace => trace.projectSlug && trace.traceId)
      .map(
        trace =>
          [
            `/organizations/${organization.slug}/events/`,
            {
              query: {
                field: ['contexts.trace', 'id', 'project'],
                query: `trace:${trace.traceId} is_transaction:1`,
                sort: '-timestamp',
                per_page: 1,
                referrer: 'trace-links-navigation',
              },
            },
          ] as const
      );
  }, [traceData, organization.slug, isEAP]);

  return useApiQueries<{data: EventTransaction[]}>(queryKeys, {
    staleTime: 1000 * 60 * 10, // 10 minutes
    enabled: queryKeys.length > 0,
  }).map(result => ({
    ...result,
    data: result.data?.data?.[0], // Get the first (root) transaction
  }));
}
