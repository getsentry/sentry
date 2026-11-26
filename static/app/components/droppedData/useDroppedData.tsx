import {useQuery} from '@tanstack/react-query';

import {chartStaleTime} from 'sentry/components/charts/chartStaleTime';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

import type {OutcomeRow} from './types';

const REFERRER = 'api.explore.dropped-data-annotations';

interface DroppedEventsResponse {
  acceptedEvents: OutcomeRow[];
  droppedEvents: OutcomeRow[];
  meta: {dataset: string; end: number; interval: number; start: number};
}

export interface UseDroppedDataParams {
  dataset: DiscoverDatasets;
  interval: string;
  projects?: number[];
}

interface UseDroppedDataQueryOptions {
  enabled?: boolean;
}

/**
 * Dropped and accepted events for the current page filters
 */
export function useDroppedData(
  {dataset, interval, projects}: UseDroppedDataParams,
  {enabled = true}: UseDroppedDataQueryOptions = {}
) {
  const organization = useOrganization();
  const droppedDataEnabled = organization.features.includes(
    'explore-data-fidelity-annotations'
  );
  const {isReady: arePageFiltersReady, selection} = usePageFilters();

  const {data, isPending, isLoading, isError, refetch} = useQuery({
    ...apiOptions.as<DroppedEventsResponse>()(
      '/organizations/$organizationIdOrSlug/events-dropped/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset,
          interval,
          referrer: REFERRER,
          ...normalizeDateTimeParams(selection.datetime),
          project: projects ?? selection.projects,
          environment: selection.environments,
        },
        staleTime: chartStaleTime(selection.datetime, interval),
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
    isLoading,
    isError,
    refetch,
  };
}
