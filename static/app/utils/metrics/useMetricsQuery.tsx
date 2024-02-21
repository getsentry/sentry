import {useMemo} from 'react';

import type {PageFilters} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {getDateTimeParams, getDDMInterval} from 'sentry/utils/metrics';
import {getUseCaseFromMRI, MRIToField, parseField} from 'sentry/utils/metrics/mri';
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

interface MetricsQueryApiRequestQuery {
  field: string;
  groupBy?: string[];
  limit?: number;
  name?: string;
  orderBy?: 'asc' | 'desc';
  query?: string;
}

const getQueryInterval = (
  query: MetricsQueryApiRequestQuery,
  datetime: PageFilters['datetime'],
  intervalLadder?: MetricsDataIntervalLadder
) => {
  const {mri: mri} = parseField(query.field) ?? {};
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';
  return getDDMInterval(datetime, useCase, intervalLadder);
};

export function getMetricsQueryApiRequestPayload(
  queries: MetricsQueryApiRequestQuery[],
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
      .map(query => getQueryInterval(query, datetime, intervalLadder))
      .reduce(
        (acc, curr) => (parsePeriodToHours(curr) > parsePeriodToHours(acc) ? curr : acc),
        '10s'
      );

  const requestQueries: {mql: string; name: string}[] = [];
  const requestFormulas: {mql: string; limit?: number; order?: 'asc' | 'desc'}[] = [];

  queries.forEach((query, index) => {
    const {field, groupBy, limit, orderBy, query: queryParam, name: nameParam} = query;
    const name = nameParam || `query_${index + 1}`;
    const hasGoupBy = groupBy && groupBy.length > 0;
    requestQueries.push({name, mql: createMqlQuery({field, query: queryParam, groupBy})});
    requestFormulas.push({
      mql: `$${name}`,
      limit,
      order: hasGoupBy ? orderBy ?? 'desc' : undefined,
    });
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

export type MetricsQueryApiQueryParams = Omit<MetricsQueryApiRequestQuery, 'field'> & {
  mri: MRI;
  op?: string;
};

export function useMetricsQuery(
  queries: MetricsQueryApiQueryParams[],
  {projects, environments, datetime}: PageFilters,
  overrides: {interval?: string; intervalLadder?: MetricsDataIntervalLadder} = {}
) {
  const organization = useOrganization();

  const queryIsComplete = queries.every(({op}) => op);

  const {query: queryToSend, body} = useMemo(
    () =>
      getMetricsQueryApiRequestPayload(
        queries.map(query => ({...query, field: MRIToField(query.mri, query.op!)})),
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
      enabled: queryIsComplete,
    }
  );
}
