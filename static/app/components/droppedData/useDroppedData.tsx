import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useDroppedDataAnnotationsEnabled} from 'sentry/components/droppedData/useDroppedDataAnnotationsEnabled';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

const REFERRER = 'api.explore.dropped-data-annotations';

interface DroppedEventsBucket {
  category: string;
  count: number;
  end: number;
  outcome: string;
  reason: string;
  start: number;
  type: string;
}

interface DroppedEventsResponse {
  acceptedEvents: DroppedEventsBucket[];
  droppedEvents: DroppedEventsBucket[];
  meta: {
    dataset: string;
    end: number;
    interval: number;
    start: number;
  };
}

// TODO: this is a temporary function to convert the bucket to an annotation.
// This and similar will be removed when the API is updated to rename
// Annotations to DroppedEvents
function toAnnotation(bucket: DroppedEventsBucket): Annotation {
  return {
    type: bucket.type,
    category: bucket.category,
    outcome: bucket.outcome,
    reason: bucket.reason,
    start: bucket.start,
    end: bucket.end,
    eventCount: bucket.count,
  };
}

export function makeDroppedDataQueryKeyPrefix(organizationSlug: string) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/events-dropped/', {
      path: {organizationIdOrSlug: organizationSlug},
    }),
  ] as const;
}

interface UseDroppedDataOptions {
  dataset: DiscoverDatasets;
}

/**
 * Dropped and accepted annotations for the current page filters and chart
 * interval loaded from `/events-dropped/`.
 */
export function useDroppedData({dataset}: UseDroppedDataOptions) {
  const annotationsEnabled = useDroppedDataAnnotationsEnabled();
  const [interval] = useChartInterval();
  const organization = useOrganization();
  const {isReady: arePageFiltersReady, selection} = usePageFilters();

  const {data, isPending} = useQuery({
    ...apiOptions.as<DroppedEventsResponse>()(
      '/organizations/$organizationIdOrSlug/events-dropped/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset,
          interval,
          referrer: REFERRER,
          ...normalizeDateTimeParams(selection.datetime),
          project: selection.projects,
          environment: selection.environments,
        },
        staleTime: Infinity,
      }
    ),
    retry: shouldRetryHandler,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus: false,
    enabled: annotationsEnabled && arePageFiltersReady,
  });

  const droppedAnnotations = useMemo(
    () => data?.droppedEvents.map(toAnnotation),
    [data?.droppedEvents]
  );
  const acceptedAnnotations = useMemo(
    () => data?.acceptedEvents.map(toAnnotation),
    [data?.acceptedEvents]
  );

  return {
    droppedAnnotations,
    acceptedAnnotations,
    isPending,
  };
}
