import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

const REFERRER = 'api.explore.dropped-data-annotations';

interface DroppedEventsResponse {
  acceptedEvents: OutcomeRow[];
  droppedEvents: OutcomeRow[];
  meta: {
    dataset: string;
    end: number;
    interval: number;
    start: number;
  };
}

export function makeDroppedDataQueryKeyPrefix(organizationSlug: string) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/events-dropped/', {
      path: {organizationIdOrSlug: organizationSlug},
    }),
  ] as const;
}

interface UseDroppedDataParams {
  dataset: DiscoverDatasets;
  interval: string;
}

interface UseDroppedDataQueryOptions {
  enabled?: boolean;
}

/**
 * Dropped and accepted events for the current page filters.
 */
export function useDroppedData(
  {dataset, interval}: UseDroppedDataParams,
  {enabled = true}: UseDroppedDataQueryOptions = {}
) {
  const organization = useOrganization();
  const droppedDataEnabled = organization.features.includes(
    'explore-data-fidelity-annotations'
  );
  const {isReady: arePageFiltersReady, selection} = usePageFilters();

  // Keep in sync with useSortedTimeSeries so the band refetches with the chart
  const {period, start, end} = selection.datetime;
  const intervalInMilliseconds = intervalToMilliseconds(interval);
  let staleTime = defined(end) && moment.utc(end).isAfter() ? 0 : Infinity;
  if (
    defined(period) &&
    !defined(start) &&
    !defined(end) &&
    intervalInMilliseconds !== 0
  ) {
    staleTime = intervalInMilliseconds;
  }

  const {data, isPending, isError, refetch} = useQuery({
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
        staleTime,
      }
    ),
    retry: shouldRetryHandler,
    retryDelay: getRetryDelay,
    refetchOnWindowFocus: false,
    enabled: enabled && droppedDataEnabled && arePageFiltersReady,
  });

  return {
    droppedEvents: data?.droppedEvents,
    acceptedEvents: data?.acceptedEvents,
    isPending,
    isError,
    refetch,
  };
}
