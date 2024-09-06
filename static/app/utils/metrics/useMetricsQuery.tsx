import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {
  getDateTimeParams,
  getMetricsInterval,
  isVirtualMetric,
} from 'sentry/utils/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {getUseCaseFromMRI, MRIToField} from 'sentry/utils/metrics/mri';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {
  MetricAggregation,
  MetricsDataIntervalLadder,
  MetricsQueryApiResponse,
  MRI,
} from '../../types/metrics';
import {parsePeriodToHours} from '../duration/parsePeriodToHours';

export function createMqlQuery({
  field,
  query,
  groupBy = [],
}: {
  field: string;
  groupBy?: string[];
  query?: string;
}) {
  let mql = field;
  if (query) {
    mql = `${mql}{${query}}`;
  }
  if (groupBy.length) {
    mql = `${mql} by (${groupBy.join(',')})`;
  }
  return mql;
}

export interface MetricsQueryApiRequestQuery {
  aggregation: MetricAggregation;
  mri: MRI;
  name: string;
  alias?: string;
  // Conditions are used to identify virtual metrics
  condition?: number;
  groupBy?: string[];
  isQueryOnly?: boolean;
  limit?: number;
  orderBy?: 'asc' | 'desc';
  query?: string;
}

export interface MetricsQueryApiRequestFormula {
  formula: string;
  name: string;
  alias?: string;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}

export type MetricsQueryApiQueryParams =
  | MetricsQueryApiRequestQuery
  | MetricsQueryApiRequestFormula;

const getQueryInterval = (
  query: MetricsQueryApiRequestQuery,
  datetime: PageFilters['datetime'],
  intervalLadder?: MetricsDataIntervalLadder
) => {
  const useCase = getUseCaseFromMRI(query.mri) ?? 'custom';
  return getMetricsInterval(datetime, useCase, intervalLadder);
};

export function isMetricFormula(
  queryEntry: MetricsQueryApiQueryParams
): queryEntry is MetricsQueryApiRequestFormula {
  return 'formula' in queryEntry;
}

export function getMetricsQueryApiRequestPayload(
  queries: (MetricsQueryApiRequestQuery | MetricsQueryApiRequestFormula)[],
  {
    projects,
    environments,
    datetime,
  }: {
    datetime: PageFilters['datetime'];
    environments: PageFilters['environments'];
    projects: (number | string)[];
  },
  {
    intervalLadder,
    interval: intervalParam,
    includeSeries = true,
  }: {
    includeSeries?: boolean;
    interval?: string;
    intervalLadder?: MetricsDataIntervalLadder;
  } = {}
) {
  // We want to use the largest interval from all queries so none fails
  // In the future the endpoint should handle this
  const interval =
    intervalParam ??
    queries
      .map(query =>
        !isMetricFormula(query) ? getQueryInterval(query, datetime, intervalLadder) : '1m'
      )
      .reduce(
        (acc, curr) => (parsePeriodToHours(curr) > parsePeriodToHours(acc) ? curr : acc),
        '1m'
      );

  const requestQueries: {mql: string; name: string}[] = [];
  const requestFormulas: {
    mql: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
  }[] = [];

  queries.forEach((query, index) => {
    if (isMetricFormula(query)) {
      requestFormulas.push({
        mql: query.formula,
        limit: query.limit,
        order: query.orderBy,
      });
      return;
    }

    const {
      mri,
      aggregation,
      groupBy,
      limit,
      orderBy,
      query: queryParam,
      name: nameParam,
      isQueryOnly,
    } = query;
    const name = nameParam || `query_${index + 1}`;
    const hasGroupBy = groupBy && groupBy.length > 0;

    requestQueries.push({
      name,
      mql: createMqlQuery({
        field: MRIToField(mri, aggregation),
        query: queryParam,
        groupBy,
      }),
    });

    if (!isQueryOnly) {
      requestFormulas.push({
        mql: `$${name}`,
        limit,
        order: hasGroupBy ? orderBy : undefined,
      });
    }
  });

  return {
    query: {
      ...getDateTimeParams(datetime),
      project: projects,
      environment: environments,
      interval,
      includeSeries,
    },
    body: {
      queries: requestQueries,
      formulas: requestFormulas,
    },
  };
}

export function useMetricsQuery(
  queries: MetricsQueryApiQueryParams[],
  {
    projects,
    environments,
    datetime,
  }: {
    datetime: PageFilters['datetime'];
    environments: PageFilters['environments'];
    projects: (number | string)[];
  },
  overrides: {
    includeSeries?: boolean;
    interval?: string;
    intervalLadder?: MetricsDataIntervalLadder;
  } = {},
  enableRefetch = true
) {
  const organization = useOrganization();
  const metricsNewInputs = hasMetricsNewInputs(organization);
  const {resolveVirtualMRI, isLoading} = useVirtualMetricsContext();

  const resolvedQueries = useMemo(
    () =>
      queries
        .map(query => {
          if (isMetricFormula(query)) {
            if (metricsNewInputs) {
              return {
                ...query,
                formula: query.formula.toUpperCase(),
              };
            }
            return query;
          }
          if (!isVirtualMetric(query)) {
            return query;
          }
          if (!query.condition) {
            // Invalid state. A virtual metric always needs to have a condition
            return null;
          }
          const {mri, aggregation} = resolveVirtualMRI(
            query.mri,
            query.condition,
            query.aggregation
          );
          return {...query, mri, aggregation};
        })
        .filter(query => query !== null),
    [queries, resolveVirtualMRI, metricsNewInputs]
  );

  const {query: queryToSend, body} = useMemo(
    () =>
      getMetricsQueryApiRequestPayload(
        resolvedQueries,
        {datetime, projects, environments},
        {...overrides}
      ),
    [resolvedQueries, datetime, projects, environments, overrides]
  );

  return useApiQuery<MetricsQueryApiResponse>(
    [
      `/organizations/${organization.slug}/metrics/query/`,
      {query: queryToSend, data: body, method: 'POST'},
    ],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: enableRefetch,
      refetchOnWindowFocus: enableRefetch,
      refetchInterval: false,
      enabled: !isLoading,
    }
  );
}
