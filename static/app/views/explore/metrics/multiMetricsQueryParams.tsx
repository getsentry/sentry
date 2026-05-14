import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
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

const MultiMetricsQueryParamsContext = createContext<
  MetricQueriesControllerValue | undefined
>(undefined);

function useMultiMetricsQueryParamsContext(): MetricQueriesControllerValue {
  const context = useContext(MultiMetricsQueryParamsContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "QueryParamsContext" must be inside a Provider with a value'
    );
  }
  return context;
}

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

interface LocalMultiMetricsQueryParamsProviderProps {
  children: ReactNode;
  /**
   * Initial metric queries to seed local state. Typically derived from a
   * saved aggregate string via `parseAggregateExpression`. If empty, the
   * provider falls back to a single default row (matching the URL-backed
   * provider's behavior on an empty URL).
   */
  initialQueries: BaseMetricQuery[];
  /**
   * Gates insert-before-equation behavior in `addMetricQuery`.
   */
  hasEquations?: boolean;
}

/**
 * Local-state counterpart to `MultiMetricsQueryParamsProvider`. Holds the
 * metric queries in `useState` instead of URL params, so the same consumer
 * hooks (`useMultiMetricsQueryParams`, `useAddMetricQuery`,
 * `useReorderMetricQueries`) work unchanged for callers that need an
 * in-memory editing surface (e.g. the tracemetric alert editor, where only
 * the selected row is persisted on save and the rest is discarded on
 * reopen).
 *
 * `initialQueries` seeds the initial state only once; changes to the prop
 * after mount are ignored. Callers that need to re-hydrate from an external
 * source should remount the provider (e.g. via a `key`).
 */
export function LocalMultiMetricsQueryParamsProvider({
  children,
  initialQueries,
  hasEquations,
}: LocalMultiMetricsQueryParamsProviderProps) {
  const [queries, setQueries] = useState<BaseMetricQuery[]>(() =>
    initialQueries.length > 0 ? initialQueries : [defaultMetricQuery()]
  );

  const value = useMetricQueriesController({queries, setQueries, hasEquations});

  return (
    <MultiMetricsQueryParamsContext value={value}>
      {children}
    </MultiMetricsQueryParamsContext>
  );
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
