import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import {hasVisualizeTransformations} from 'sentry/views/explore/queryParams/visualize';

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

  // nuqs only sees its own writes once this provider's effects subscribe, which
  // is after children's mount effects. Until a write flushes, build on it here
  // so a second write in the same mount doesn't start from the stale URL.
  const pendingRawQueries = useRef<string[] | null>(null);

  const setQueries = useCallback(
    (update: SetStateAction<BaseMetricQuery[]>) => {
      let nextRawQueries: string[] | undefined;
      const flushed = setRawQueries(({metric: stateRawQueries}) => {
        const previousRawQueries = pendingRawQueries.current ?? stateRawQueries;
        const nextQueries =
          typeof update === 'function'
            ? update(decodeMetricQueries(previousRawQueries))
            : update;
        nextRawQueries = encodeMetricQueries(nextQueries);
        if (isEqual(nextRawQueries, previousRawQueries)) {
          return {};
        }
        pendingRawQueries.current = nextRawQueries;
        return {metric: nextRawQueries};
      });
      void flushed.finally(() => {
        if (pendingRawQueries.current === nextRawQueries) {
          pendingRawQueries.current = null;
        }
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
  occurrence: number
): BaseMetricQuery | null {
  const key = `${occurrence}:${value}`;
  const cached = decodedMetricQueries.get(key);
  const decoded = cached === undefined ? decodeMetricsQueryParams(value) : cached;
  decodedMetricQueries.delete(key);
  decodedMetricQueries.set(key, decoded);
  if (decodedMetricQueries.size > MAX_DECODED_METRIC_QUERIES) {
    decodedMetricQueries.delete(decodedMetricQueries.keys().next().value!);
  }

  return decoded;
}

function decodeMetricQueries(rawQueries: string[]): BaseMetricQuery[] {
  const occurrences = new Map<string, number>();
  const metricQueries = rawQueries
    .map(value => {
      const occurrence = occurrences.get(value) ?? 0;
      occurrences.set(value, occurrence + 1);
      return decodeMetricQueryParamsCached(value, occurrence);
    })
    .filter(defined);

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

export function useMetricsQueryParamsHasTransformations(): boolean {
  return useMultiMetricsQueryParams().some(query =>
    hasVisualizeTransformations(query.queryParams.visualizes)
  );
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
