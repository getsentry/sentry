import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {getDateTimeParams, getDDMInterval} from 'sentry/utils/metrics';
import {getUseCaseFromMRI, MRIToField} from 'sentry/utils/metrics/mri';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {
  MetricsDataIntervalLadder,
  MetricsQueryApiResponse,
  MRI,
} from '../../types/metrics';

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
  mri: MRI;
  name: string;
  op: string;
  groupBy?: string[];
  isQueryOnly?: boolean;
  limit?: number;
  orderBy?: 'asc' | 'desc';
  query?: string;
}

interface MetricsQueryApiRequestFormula {
  formula: string;
  name: string;
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
  return getDDMInterval(datetime, useCase, intervalLadder);
};

export function isMetricFormula(
  queryEntry: MetricsQueryApiQueryParams
): queryEntry is MetricsQueryApiRequestFormula {
  return 'formula' in queryEntry;
}

export function getMetricsQueryApiRequestPayload(
  queries: (MetricsQueryApiRequestQuery | MetricsQueryApiRequestFormula)[],
  {projects, environments, datetime}: PageFilters,
  {
    intervalLadder,
    interval: intervalParam,
  }: {interval?: string; intervalLadder?: MetricsDataIntervalLadder} = {}
) {
  // We want to use the largest interval from all queries so none fails
  // In the future the endpoint should handle this
  const interval =
    intervalParam ??
    queries
      .map(query =>
        !isMetricFormula(query)
          ? getQueryInterval(query, datetime, intervalLadder)
          : '10s'
      )
      .reduce(
        (acc, curr) => (parsePeriodToHours(curr) > parsePeriodToHours(acc) ? curr : acc),
        '10s'
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
      op,
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
        field: MRIToField(mri, op),
        query: queryParam,
        groupBy,
      }),
    });

    if (!isQueryOnly) {
      requestFormulas.push({
        mql: `$${name}`,
        limit,
        order: hasGroupBy ? orderBy ?? 'desc' : undefined,
      });
    }
  });

  return {
    query: {
      ...getDateTimeParams(datetime),
      project: projects,
      environment: environments,
      interval,
    },
    body: {
      queries: requestQueries,
      formulas: requestFormulas,
    },
  };
}

export function useMetricsQuery(
  queries: MetricsQueryApiQueryParams[],
  {projects, environments, datetime}: PageFilters,
  overrides: {interval?: string; intervalLadder?: MetricsDataIntervalLadder} = {}
) {
  const organization = useOrganization();

  const {query: queryToSend, body} = useMemo(
    () =>
      getMetricsQueryApiRequestPayload(
        queries,
        {datetime, projects, environments},
        {...overrides}
      ),
    [queries, datetime, projects, environments, overrides]
  );

  return useApiQuery<MetricsQueryApiResponse>(
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
}
