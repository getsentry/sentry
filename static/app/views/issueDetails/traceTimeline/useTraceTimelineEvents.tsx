import {useMemo} from 'react';

import type {Event} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface BaseEvent {
  id: string;
  'issue.id': number;
  project: string;
  'project.name': string;
  timestamp: string;
  title: string;
  transaction: string;
}

interface TimelineDiscoverEvent extends BaseEvent {}
interface TimelineIssuePlatformEvent extends BaseEvent {
  'event.type': string;
  'stack.function': string[];
}

export type TimelineEvent = TimelineDiscoverEvent | TimelineIssuePlatformEvent;

export interface TraceEventResponse {
  data: TimelineEvent[];
  meta: unknown;
}

interface UseTraceTimelineEventsOptions {
  event: Event;
}

export function useTraceTimelineEvents({event}: UseTraceTimelineEventsOptions): {
  endTimestamp: number;
  isError: boolean;
  isLoading: boolean;
  startTimestamp: number;
  traceEvents: TimelineEvent[];
} {
  const organization = useOrganization();
  const {start, end} = getTraceTimeRangeFromEvent(event);

  const traceId = event.contexts?.trace?.trace_id ?? '';
  const enabled = !!traceId;
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
          field: ['title', 'project', 'timestamp', 'issue.id', 'transaction'],
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
          field: [
            'title',
            'project',
            'timestamp',
            'issue.id',
            'transaction',
            'event.type',
            'stack.function',
          ],
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

    // Events is unsorted since they're grouped by date later
    const events = [...issuePlatformData.data, ...discoverData.data];

    // The current event might be missing when there is a large number of issues
    const hasCurrentEvent = events.some(e => e.id === event.id);
    if (!hasCurrentEvent) {
      events.push({
        id: event.id,
        'issue.id': Number(event.groupID),
        project: event.projectID,
        // The project name for current event is not used
        'project.name': '',
        timestamp: event.dateCreated!,
        title: event.title,
        transaction: '',
      });
    }
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const startTimestamp = Math.min(...timestamps);
    const endTimestamp = Math.max(...timestamps);
    return {
      data: events,
      startTimestamp,
      endTimestamp,
    };
  }, [
    event,
    issuePlatformData,
    discoverData,
    isLoadingIssuePlatform,
    isLoadingDiscover,
    isErrorIssuePlatform,
    isErrorDiscover,
  ]);

  return {
    traceEvents: eventData.data,
    startTimestamp: eventData.startTimestamp,
    endTimestamp: eventData.endTimestamp,
    isLoading: isLoadingIssuePlatform || isLoadingDiscover,
    isError: isErrorIssuePlatform || isErrorDiscover,
  };
}
