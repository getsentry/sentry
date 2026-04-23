import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResult,
} from 'sentry/views/explore/metrics/types';

interface UseMetricOptionsProps {
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  environments?: PageFilters['environments'];
  orgSlug?: string;
  projectIds?: PageFilters['projects'];
  search?: string;
}

function metricOptionsQueryKey({
  orgSlug,
  projectIds,
  datetime,
  search,
  environments,
  hasMetricUnitsUI,
}: UseMetricOptionsProps & {hasMetricUnitsUI?: boolean} = {}) {
  const queryFields = [
    TraceMetricKnownFieldKey.METRIC_NAME,
    TraceMetricKnownFieldKey.METRIC_TYPE,
    `count(${TraceMetricKnownFieldKey.METRIC_NAME})`,
    `max(${TraceMetricKnownFieldKey.TIMESTAMP_PRECISE})`,
  ];

  if (hasMetricUnitsUI) {
    queryFields.push(TraceMetricKnownFieldKey.METRIC_UNIT);
  }

  let searchValue: MutableSearch | undefined = undefined;
  if (search) {
    searchValue = new MutableSearch('');
    searchValue.addContainsFilterValue(TraceMetricKnownFieldKey.METRIC_NAME, search);
  }

  const query: Record<string, string | string[] | number[] | undefined> = {
    dataset: DiscoverDatasets.TRACEMETRICS,
    field: queryFields,
    referrer: 'api.explore.metric-options',
    query: defined(searchValue) ? searchValue.formatString() : undefined,
    caseInsensitive: defined(searchValue) ? '1' : undefined,
    project: projectIds?.length ? projectIds?.map(String) : undefined,
    environment: environments?.length ? environments : undefined,
  };

  if (datetime) {
    Object.entries(normalizeDateTimeParams(datetime)).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value as string | string[];
      }
    });
  }

  return apiOptions.as<TraceMetricEventsResult>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: orgSlug!},
      query,
      staleTime: 5 * 60 * 1000,
    }
  );
}

/**
 * Hook to fetch available metric names and types from the tracemetrics dataset.
 * This is used to populate metric selection options in the Explore interface.
 */
export function useMetricOptions({
  search,
  projectIds,
  datetime,
  environments,
  enabled = true,
}: UseMetricOptionsProps = {}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const hasMetricUnitsUI = useHasMetricUnitsUI();

  const {
    data: result,
    isFetching,
    isLoading,
  } = useQuery({
    ...metricOptionsQueryKey({
      search,
      orgSlug: organization.slug,
      projectIds: projectIds ?? selection.projects,
      datetime: datetime ?? selection.datetime,
      environments: environments ?? selection.environments,
      hasMetricUnitsUI,
    }),

    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    enabled,
  });

  const filteredData = useMemo(() => {
    if (!result?.data) {
      return undefined;
    }
    // Filter out empty string metric names which cause infinite update loops
    return result.data
      .filter(item => item[TraceMetricKnownFieldKey.METRIC_NAME]?.length > 0)
      .sort((a, b) =>
        a[TraceMetricKnownFieldKey.METRIC_NAME].localeCompare(
          b[TraceMetricKnownFieldKey.METRIC_NAME]
        )
      );
  }, [result?.data]);

  const isMetricOptionsEmpty =
    !isFetching && !isLoading && (!filteredData || filteredData.length === 0);

  return {
    data: filteredData ? {...result, data: filteredData} : result,
    isMetricOptionsEmpty,
    isFetching,
  };
}
