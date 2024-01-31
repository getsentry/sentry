import {useMemo} from 'react';

import type {Event} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface TimelineEvent {
  id: string;
  issue: string;
  'issue.id': number;
  project: string;
  'project.name': string;
  timestamp: string;
  title: string;
}

export interface TraceEventResponse {
  data: TimelineEvent[];
  meta: unknown;
}

interface UseTraceTimelineEventsOptions {
  event: Event;
}

export function useTraceTimelineEvents(
  {event}: UseTraceTimelineEventsOptions,
  isEnabled: boolean = true
) {
  const organization = useOrganization();
  const {start, end} = getTraceTimeRangeFromEvent(event);

  const traceId = event.contexts?.trace?.trace_id ?? '';
  const enabled = !!traceId && isEnabled;
  const {
    data: issuePlatformData,
    isLoading: isLoadingIssuePlatform,
    isError: isErrorIssuePlatform,
  } = useApiQuery<TraceEventResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          // Get performance issues
          dataset: DiscoverDatasets.ISSUE_PLATFORM,
          field: ['title', 'project', 'timestamp', 'issue.id', 'issue'],
          per_page: 100,
          query: `trace:${traceId}`,
          referrer: 'api.issues.issue_events',
          sort: '-timestamp',
          start,
          end,
        },
      },
    ],
    {staleTime: Infinity, retry: false, enabled}
  );
  const {
    data: discoverData,
    isLoading: isLoadingDiscover,
    isError: isErrorDiscover,
  } = useApiQuery<{
    data: TimelineEvent[];
    meta: unknown;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          // Other events
          dataset: DiscoverDatasets.DISCOVER,
          field: ['title', 'project', 'timestamp', 'issue.id', 'issue'],
          per_page: 100,
          query: `trace:${traceId}`,
          referrer: 'api.issues.issue_events',
          sort: '-timestamp',
          start,
          end,
        },
      },
    ],
    {staleTime: Infinity, retry: false, enabled}
  );

  const eventData = useMemo(() => {
    if (
      isLoadingIssuePlatform ||
      isLoadingDiscover ||
      isErrorIssuePlatform ||
      isErrorDiscover
    ) {
      return {
        data: [],
        startTimestamp: 0,
        endTimestamp: 0,
      };
    }

    const events = [...issuePlatformData.data, ...discoverData.data];
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const startTimestamp = Math.min(...timestamps);
    const endTimestamp = Math.max(...timestamps);
    return {
      data: events,
      startTimestamp,
      endTimestamp,
    };
  }, [
    issuePlatformData,
    discoverData,
    isLoadingIssuePlatform,
    isLoadingDiscover,
    isErrorIssuePlatform,
    isErrorDiscover,
  ]);

  return {
    data: eventData.data,
    startTimestamp: eventData.startTimestamp,
    endTimestamp: eventData.endTimestamp,
    isLoading: isLoadingIssuePlatform || isLoadingDiscover,
    isError: isErrorIssuePlatform || isErrorDiscover,
  };
}
