import {useCallback, useMemo, type ReactNode} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
  type BaseMetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricQueriesController,
  type MetricQueriesControllerValue,
} from 'sentry/views/explore/metrics/useMetricQueriesController';

export const MAX_METRICS_ALLOWED = 8;

function encodeMetricQueries(metricQueries: BaseMetricQuery[]): string[] {
  return metricQueries
    .map((metricQuery: BaseMetricQuery) => encodeMetricQueryParams(metricQuery))
    .filter(defined)
    .filter(Boolean);
}

const [
  _MultiMetricsQueryParamsContextProvider,
  useMultiMetricsQueryParamsContext,
  MultiMetricsQueryParamsContext,
] = createDefinedContext<MetricQueriesControllerValue>({
  name: 'QueryParamsContext',
});

interface MultiMetricsQueryParamsProviderProps {
  children: ReactNode;
  allowUpTo?: number;
  hasEquations?: boolean;
}

export function MultiMetricsQueryParamsProvider({
  children,
  allowUpTo,
  hasEquations,
}: MultiMetricsQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const queries = useMemo(
    () => getMultiMetricsQueryParamsFromLocation(location, allowUpTo),
    [location, allowUpTo]
  );

  const setQueries = useCallback(
    (nextQueries: BaseMetricQuery[]) => {
      const target = {...location, query: {...location.query}};
      target.query.metric = encodeMetricQueries(nextQueries);
      navigate(target);
    },
    [location, navigate]
  );

  const value = useMetricQueriesController({queries, setQueries, hasEquations});

  return (
    <MultiMetricsQueryParamsContext value={value}>
      {children}
    </MultiMetricsQueryParamsContext>
  );
}

function getMultiMetricsQueryParamsFromLocation(
  location: Location,
  limit?: number
): BaseMetricQuery[] {
  const rawQueryParams = decodeList(location.query.metric);

  const metricQueries = rawQueryParams
    .map(value => decodeMetricsQueryParams(value))
    .filter(defined);

  const queries = metricQueries.length ? metricQueries : [defaultMetricQuery()];

  return limit ? queries.slice(0, limit) : queries;
}

export function useMultiMetricsQueryParams() {
  const {metricQueries} = useMultiMetricsQueryParamsContext();
  return metricQueries;
}

export function useAddMetricQuery({
  type = 'aggregate',
}: {type?: 'aggregate' | 'equation'} = {}) {
  const {addMetricQuery} = useMultiMetricsQueryParamsContext();
  return useCallback(() => addMetricQuery({type}), [addMetricQuery, type]);
}

export function useReorderMetricQueries() {
  const {reorderMetricQueries} = useMultiMetricsQueryParamsContext();
  return reorderMetricQueries;
}
