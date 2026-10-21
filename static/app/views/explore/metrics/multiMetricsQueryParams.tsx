import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';
import isEqual from 'lodash/isEqual';
import {useQueryStates} from 'nuqs';

import {defined} from 'sentry/utils/defined';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
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
}

const metricQueryParsers = {
  metric: parseAsStringArray.withOptions({history: 'push'}),
};

export function MultiMetricsQueryParamsProvider({
  children,
}: MultiMetricsQueryParamsProviderProps) {
  const [{metric: rawQueries}, setRawQueries] = useQueryStates(metricQueryParsers);

  const queries = useMemo(() => decodeMetricQueries(rawQueries), [rawQueries]);

  const setQueries = useCallback(
    (update: SetStateAction<BaseMetricQuery[]>) => {
      void setRawQueries(({metric: previousRawQueries}) => {
        const nextQueries =
          typeof update === 'function'
            ? update(decodeMetricQueries(previousRawQueries))
            : update;
        const nextRawQueries = encodeMetricQueries(nextQueries);
        return isEqual(nextRawQueries, previousRawQueries)
          ? {}
          : {metric: nextRawQueries};
      });
    },
    [setRawQueries]
  );

  const value = useMetricQueriesController({queries, setQueries});

  return (
    <MultiMetricsQueryParamsContext value={value}>
      {children}
    </MultiMetricsQueryParamsContext>
  );
}

const decodedMetricQueries = new Map<string, BaseMetricQuery | null>();
const MAX_DECODED_METRIC_QUERIES = 100;

function decodeMetricQueryParamsCached(
  value: string,
  index: number
): BaseMetricQuery | null {
  const key = `${index}:${value}`;
  if (!decodedMetricQueries.has(key)) {
    if (decodedMetricQueries.size >= MAX_DECODED_METRIC_QUERIES) {
      decodedMetricQueries.clear();
    }
    decodedMetricQueries.set(key, decodeMetricsQueryParams(value));
  }
  return decodedMetricQueries.get(key) ?? null;
}

function decodeMetricQueries(rawQueries: string[]): BaseMetricQuery[] {
  const metricQueries = rawQueries.map(decodeMetricQueryParamsCached).filter(defined);

  return metricQueries.length ? metricQueries : [defaultMetricQuery()];
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
}: LocalMultiMetricsQueryParamsProviderProps) {
  const [queries, setQueries] = useState<BaseMetricQuery[]>(() =>
    initialQueries.length > 0 ? initialQueries : [defaultMetricQuery()]
  );

  const value = useMetricQueriesController({queries, setQueries});

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
