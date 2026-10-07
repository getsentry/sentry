import {useQuery} from '@tanstack/react-query';

import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {useDroppedDataEnabled} from 'sentry/components/droppedData/useDroppedDataEnabled';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

const REFERRER = 'api.explore.dropped-data-annotations';

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
 * Dropped and accepted events for the current page filters and chart interval.
 */
export function useDroppedData({dataset}: UseDroppedDataOptions) {
  const droppedDataEnabled = useDroppedDataEnabled();
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
    enabled: droppedDataEnabled && arePageFiltersReady,
  });

  return {
    droppedEvents: data?.droppedEvents,
    acceptedEvents: data?.acceptedEvents,
    isPending,
  };
}
