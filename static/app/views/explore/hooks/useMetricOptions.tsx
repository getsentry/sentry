import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface EventsMetricResult {
  data: Array<{
    ['metric.name']: string;
    ['metric.type']: 'counter' | 'distribution' | 'gauge';
  }>;
  meta?: {
    fields?: Record<string, string>;
  };
}

interface UseMetricOptionsProps {
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  projectIds?: PageFilters['projects'];
}

function metricOptionsQueryKey({
  orgSlug,
  projectIds,
  datetime,
}: {
  orgSlug: string;
  datetime?: PageFilters['datetime'];
  projectIds?: number[];
}): ApiQueryKey {
  const query: Record<string, string | string[] | number[]> = {
    dataset: DiscoverDatasets.TRACEMETRICS,
    field: ['metric.name', 'metric.type', 'count(metric.name)'],
    referrer: 'api.explore.metric-options',
    orderby: 'metric.name',
  };

  if (projectIds?.length) {
    query.project = projectIds.map(String);
  }

  if (datetime) {
    Object.entries(normalizeDateTimeParams(datetime)).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value as string | string[];
      }
    });
  }

  return [`/organizations/${orgSlug}/events/`, {query}];
}

/**
 * Hook to fetch available metric names and types from the tracemetrics dataset.
 * This is used to populate metric selection options in the Explore interface.
 */
export function useMetricOptions({
  projectIds,
  datetime,
  enabled = true,
}: UseMetricOptionsProps = {}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryKey = useMemo(
    () =>
      metricOptionsQueryKey({
        orgSlug: organization.slug,
        projectIds: projectIds ?? selection.projects,
        datetime: datetime ?? selection.datetime,
      }),
    [organization.slug, projectIds, selection.projects, selection.datetime, datetime]
  );

  return useApiQuery<EventsMetricResult>(queryKey, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    enabled,
  });
}
