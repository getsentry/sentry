import {useCallback, useEffect, useState} from 'react';

import type {DateString, MetricsApiResponse} from 'sentry/types';
import {getMetricsApiRequestQuery, mapToMRIFields} from 'sentry/utils/metrics';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricsApiRequestQueryOptions} from '../../types/metrics';

export function useMetricsData(
  {mri, op, datetime, projects, environments, query, groupBy}: MetricsQuery,
  overrides: Partial<MetricsApiRequestQueryOptions> = {}
) {
  const organization = useOrganization();

  const field = op ? `${op}(${mri})` : mri;

  const queryToSend = getMetricsApiRequestQuery(
    {
      field,
      query: query ?? '',
      groupBy,
    },
    {datetime, projects, environments},
    {...overrides}
  );

  const metricsApiRepsonse = useApiQuery<MetricsApiResponse>(
    [`/organizations/${organization.slug}/metrics/data/`, {query: queryToSend}],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchInterval: false,
    }
  );
  mapToMRIFields(metricsApiRepsonse.data, [field]);

  return metricsApiRepsonse;
}

// Wraps useMetricsData and provides two additional features:
// 1. return data is undefined only during the initial load
// 2. provides a callback to trim the data to a specific time range when chart zoom is used
export function useMetricsDataZoom(
  metricsQuery: MetricsQuery,
  overrides: Partial<MetricsApiRequestQueryOptions> = {}
) {
  const [metricsData, setMetricsData] = useState<MetricsApiResponse | undefined>();
  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useMetricsData(metricsQuery, overrides);

  useEffect(() => {
    if (rawData) {
      setMetricsData(rawData);
    }
  }, [rawData]);

  const trimData = useCallback(
    (
      currentData: MetricsApiResponse | undefined,
      start,
      end
    ): MetricsApiResponse | undefined => {
      if (!currentData) {
        return currentData;
      }
      // find the index of the first interval that is greater than the start time
      const startIndex =
        currentData.intervals.findIndex(interval => interval >= start) - 1;
      const endIndex = currentData.intervals.findIndex(interval => interval >= end);

      if (startIndex === -1 || endIndex === -1) {
        return currentData;
      }

      return {
        ...currentData,
        intervals: currentData.intervals.slice(startIndex, endIndex),
        groups: currentData.groups.map(group => ({
          ...group,
          series: Object.fromEntries(
            Object.entries(group.series).map(([seriesName, series]) => [
              seriesName,
              series.slice(startIndex, endIndex),
            ])
          ),
        })),
      };
    },
    []
  );

  const handleZoom = useCallback(
    (start: DateString, end: DateString) => {
      setMetricsData(currentData => trimData(currentData, start, end));
    },
    [trimData]
  );

  return {
    data: metricsData,
    isLoading,
    isError,
    error,
    onZoom: handleZoom,
  };
}
