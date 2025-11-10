import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

import type {TraceViewQueryParams} from './useTraceQueryParams';

interface UseInitialTraceMetricDataProps {
  queryParams: TraceViewQueryParams;
  traceId: string;
  enabled?: boolean;
}

const COUNT_FIELD = `count(${TraceMetricKnownFieldKey.METRIC_NAME})`;

interface TraceMetricCountResult {
  data: Array<{
    [COUNT_FIELD]: number;
  }>;
}

function traceMetricCountQueryKey({
  orgSlug,
  traceId,
  queryParams,
  projectIds,
}: {
  orgSlug: string;
  projectIds: PageFilters['projects'];
  queryParams: TraceViewQueryParams;
  traceId: string;
}): ApiQueryKey {
  const searchValue = new MutableSearch('');
  searchValue.addFilterValue(TraceMetricKnownFieldKey.TRACE, traceId);

  const query: Record<string, string | string[] | number[]> = {
    dataset: DiscoverDatasets.TRACEMETRICS,
    field: [COUNT_FIELD],
    query: searchValue.formatString(),
    referrer: 'api.trace-details.initial-metric-data',
  };

  if (projectIds?.length) {
    query.project = projectIds.map(String);
  }

  if (queryParams.timestamp) {
    // Use the timestamp to set an interval of +/- 1 days.
    query.start = new Date(
      queryParams.timestamp * 1000 - 24 * 60 * 60 * 1000
    ).toISOString();
    query.end = new Date(
      queryParams.timestamp * 1000 + 24 * 60 * 60 * 1000
    ).toISOString();
  }

  return [`/organizations/${orgSlug}/events/`, {query}];
}

/**
 * Hook to fetch initial trace metric count data for a specific trace ID.
 * Returns a memoized object with the count to avoid unnecessary re-renders.
 *
 * Used in trace view for approximate metrics count (may vary on statsperiod).
 * Should not be used for fetching metrics data, use useMetricAggregatesTable instead.
 */
export function useInitialTraceMetricData({
  traceId,
  queryParams,
  enabled = true,
}: UseInitialTraceMetricDataProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const hasMetricsFeature = canUseMetricsUI(organization);

  const queryKey = useMemo(
    () =>
      traceMetricCountQueryKey({
        orgSlug: organization.slug,
        traceId,
        queryParams,
        projectIds: selection.projects,
      }),
    [organization.slug, traceId, queryParams, selection.projects]
  );

  const result = useApiQuery<TraceMetricCountResult>(queryKey, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    enabled: enabled && Boolean(traceId) && hasMetricsFeature,
  });

  const metricsData = useMemo(() => {
    const count = result.data?.data?.[0]?.[COUNT_FIELD] ?? 0;
    return {count};
  }, [result.data]);

  return {
    ...result,
    metricsData,
  };
}
