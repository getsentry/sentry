import {useEffect, useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResult,
} from 'sentry/views/explore/metrics/types';

interface UseMetricOptionsProps {
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  orgSlug?: string;
  projectIds?: PageFilters['projects'];
  search?: string;
}

function metricOptionsQueryKey({
  orgSlug,
  projectIds,
  datetime,
  search,
}: UseMetricOptionsProps = {}): ApiQueryKey {
  const searchValue = new MutableSearch('');
  if (search) {
    searchValue.addStringContainsFilter(
      `${TraceMetricKnownFieldKey.METRIC_NAME}:${search}`
    );
  }
  const query: Record<string, string | string[] | number[]> = {
    dataset: DiscoverDatasets.TRACEMETRICS,
    field: [
      TraceMetricKnownFieldKey.METRIC_NAME,
      TraceMetricKnownFieldKey.METRIC_TYPE,
      `count(${TraceMetricKnownFieldKey.METRIC_NAME})`,
    ],
    query: searchValue.formatString(),
    referrer: 'api.explore.metric-options',
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
  search,
  projectIds,
  datetime,
  enabled = true,
}: UseMetricOptionsProps = {}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryKey = useMemo(
    () =>
      metricOptionsQueryKey({
        search,
        orgSlug: organization.slug,
        projectIds: projectIds ?? selection.projects,
        datetime: datetime ?? selection.datetime,
      }),
    [
      organization.slug,
      projectIds,
      search,
      selection.projects,
      selection.datetime,
      datetime,
    ]
  );

  const result = useApiQuery<TraceMetricEventsResult>(queryKey, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    enabled,
  });

  // This replaces order-by metric.name as that will never be performant over large time periods with high numbers of metrics.
  useEffect(() => {
    if (result.data?.data) {
      result.data.data.sort((a, b) => {
        return a[TraceMetricKnownFieldKey.METRIC_NAME].localeCompare(
          b[TraceMetricKnownFieldKey.METRIC_NAME]
        );
      });
    }
  }, [result.data]);

  const isMetricOptionsEmpty =
    !result.isFetching &&
    !result.isLoading &&
    (!result.data?.data || result.data.data.length === 0);

  return {
    ...result,
    isMetricOptionsEmpty,
  };
}
