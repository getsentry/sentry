import {useCallback, useEffect, useMemo, useState} from 'react';

import type {DateString, MetricsApiResponse, PageFilters} from 'sentry/types';
import {getDateTimeParams, getDDMInterval} from 'sentry/utils/metrics';
import {getUseCaseFromMRI, parseField} from 'sentry/utils/metrics/mri';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {MetricsApiRequestQueryOptions} from '../../types/metrics';

function createMqlQuery({
  field,
  query,
  groupBy = [],
}: {field: string; query: string; groupBy?: string[]}) {
  let mql = field;
  if (query) {
    mql = `${mql}{${query}}`;
  }
  if (groupBy.length) {
    mql = `${mql} by (${groupBy.join(',')})`;
  }
  return mql;
}

export function getMetricsApiRequestQuery(
  {
    field,
    query,
    groupBy,
    orderBy,
  }: {field: string; query: string; groupBy?: string[]; orderBy?: 'asc' | 'desc'},
  {projects, environments, datetime}: PageFilters,
  {intervalLadder, ...overrides}: Partial<MetricsApiRequestQueryOptions> = {}
) {
  const {mri: mri} = parseField(field) ?? {};
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';
  const interval = getDDMInterval(datetime, useCase, intervalLadder);

  return {
    query: {
      ...getDateTimeParams(datetime),
      project: projects,
      environment: environments,
      interval,
      ...overrides,
    },
    body: {
      queries: [
        {
          name: 'query_1',
          mql: createMqlQuery({field, query, groupBy}),
        },
      ],
      formulas: [{mql: '$query_1', limit: overrides.limit, order: orderBy ?? 'desc'}],
    },
  };
}

interface NewMetricsApiResponse {
  data: {
    by: Record<string, string>;
    series: Array<number | null>;
    totals: Record<string, number | null>;
  }[][];
  end: string;
  intervals: string[];
  meta: [
    {name: string; type: string},
    {group_bys: string[]; limit: number | null; order: string | null},
  ][];
  start: string;
}

export function useMetricsData(
  {mri, op, datetime, projects, environments, query, groupBy}: MetricsQuery,
  overrides: Partial<MetricsApiRequestQueryOptions> = {}
) {
  const organization = useOrganization();

  const field = op ? `${op}(${mri})` : mri;

  const {query: queryToSend, body} = getMetricsApiRequestQuery(
    {
      field,
      query: query ?? '',
      groupBy,
    },
    {datetime, projects, environments},
    {...overrides}
  );

  const metricsApiResponse = useApiQuery<NewMetricsApiResponse>(
    [
      `/organizations/${organization.slug}/metrics/query/`,
      {query: queryToSend, data: body, method: 'POST'},
    ],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchInterval: false,
    }
  );

  const dataInOldShape = useMemo(
    () => mapToOldResponseShape(metricsApiResponse.data, field),
    [field, metricsApiResponse.data]
  );

  return {
    ...metricsApiResponse,
    data: dataInOldShape,
  };
}

function mapToOldResponseShape(
  responseData: NewMetricsApiResponse | undefined,
  field: string
): MetricsApiResponse | undefined {
  return (
    responseData &&
    ({
      groups: responseData.data[0].map(group => ({
        ...group,
        series: {
          [field]: group.series,
        },
      })),
      intervals: responseData.intervals,
      meta: [],
      query: '',
      start: responseData.start,
      end: responseData.end,
    } satisfies MetricsApiResponse)
  );
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
