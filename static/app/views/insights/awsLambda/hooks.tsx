import {useCallback, useEffect, useMemo, useState} from 'react';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  allFunctions,
  health,
  HOUR,
  type LambdaFunction,
  makeWindow,
  previousWindow,
  type TimeWindow,
  totals,
} from 'sentry/views/insights/awsLambda/mockData';
import {useMockStore} from 'sentry/views/insights/awsLambda/mockStore';

/** Auto-refresh intervals in seconds, like CloudWatch and Grafana offer. */
export const REFRESH_OPTIONS = [10, 30, 60, 300];

// Manual "refresh now" for every page using the window.
const refreshListeners = new Set<() => void>();
export function refreshNow() {
  refreshListeners.forEach(listener => listener());
}

/**
 * The selected time range as a window, following the page date filter (and chart zoom).
 * With auto-refresh on and a relative range, the window keeps ending at now.
 */
export function useLambdaWindow(): {
  /** Auto-refresh only works on relative ranges; a zoomed (absolute) range turns it off. */
  canRefresh: boolean;
  live: boolean;
  /** When the window was last evaluated; part of query keys so refreshes refetch. */
  now: number;
  previous: TimeWindow;
  refresh: number | null;
  setRefresh: (seconds: number | null) => void;
  window: TimeWindow;
} {
  const {selection} = usePageFilters();
  const [refreshParam, setRefreshParam] = useUrlState('refresh');
  const [now, setNow] = useState(() => Date.now());
  const {start, end, period} = selection.datetime;
  const canRefresh = !(start && end);
  const refresh =
    canRefresh && refreshParam && REFRESH_OPTIONS.includes(Number(refreshParam))
      ? Number(refreshParam)
      : null;

  useEffect(() => {
    const listener = () => setNow(Date.now());
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!refresh) {
      return;
    }
    // Hidden tabs don't refresh, like Grafana.
    const id = setInterval(
      () => document.visibilityState === 'visible' && setNow(Date.now()),
      refresh * 1000
    );
    return () => clearInterval(id);
  }, [refresh]);

  const window = useMemo(() => {
    if (start && end) {
      return makeWindow(new Date(start).getTime(), new Date(end).getTime());
    }
    const hours = parsePeriodToHours(period ?? '24h') || 24;
    return makeWindow(now - hours * HOUR, now);
  }, [start, end, period, now]);

  return {
    window,
    previous: useMemo(() => previousWindow(window), [window]),
    live: refresh !== null,
    now,
    refresh,
    canRefresh,
    setRefresh: (seconds: number | null) =>
      setRefreshParam(seconds ? String(seconds) : undefined),
  };
}

/** A single URL query parameter as state, so views are shareable. */
export function useUrlState(
  key: string
): [string | undefined, (value: string | undefined) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const value = decodeScalar(location.query[key]);
  const setValue = useCallback(
    (next: string | undefined) => {
      navigate(
        {...location, query: {...location.query, [key]: next || undefined}},
        {replace: true}
      );
    },
    [key, location, navigate]
  );
  return [value, setValue];
}

export function useUrlListState(key: string): [string[], (values: string[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const values = decodeList(location.query[key]);
  const setValues = useCallback(
    (next: string[]) => {
      navigate(
        {...location, query: {...location.query, [key]: next.length ? next : undefined}},
        {replace: true}
      );
    },
    [key, location, navigate]
  );
  return [values, setValues];
}

export const FACETS = [
  {key: 'runtime', label: 'Runtime', value: (fn: LambdaFunction) => fn.runtime},
  {
    key: 'trigger',
    label: 'Trigger',
    value: (fn: LambdaFunction) => fn.triggers[0]!.label,
  },
  {key: 'team', label: 'Team', value: (fn: LambdaFunction) => fn.team},
  {key: 'region', label: 'Region', value: (fn: LambdaFunction) => fn.region},
] as const;

/** Functions after the search box, facets and health filter on the page. */
export function useFilteredFunctions(window: TimeWindow) {
  const location = useLocation();
  const search = (decodeScalar(location.query.q) ?? '').toLowerCase();
  const healthFilter = decodeList(location.query.health);
  const {version} = useMockStore();
  return useMemo(
    () =>
      allFunctions().filter(fn => {
        if (
          search &&
          !`${fn.name} ${fn.team} ${fn.runtime} ${fn.triggers[0]!.source}`
            .toLowerCase()
            .includes(search)
        ) {
          return false;
        }
        for (const facet of FACETS) {
          const selected = decodeList(location.query[facet.key]);
          if (selected.length && !selected.includes(facet.value(fn))) {
            return false;
          }
        }
        if (
          healthFilter.length &&
          !healthFilter.includes(health(fn, totals([fn], window)))
        ) {
          return false;
        }
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, healthFilter, location.query, window, version]
  );
}

/** Keeps the time range when linking between pages. */
export function useTimeQuery() {
  const location = useLocation();
  const {statsPeriod, start, end, project, refresh} = location.query;
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries({statsPeriod, start, end, project, refresh}).filter(
          ([, v]) => v !== undefined
        )
      ),
    [statsPeriod, start, end, project, refresh]
  );
}

/**
 * Runs a mock computation like an API request: with latency, keeping the previous result
 * while the next one loads, so the UI shows loading states instead of snapping.
 * Pass the window's end in the key so auto-refresh refetches.
 */
export function useMockQuery<T>(key: readonly unknown[], compute: () => T) {
  const {version} = useMockStore();
  // The key fully describes the computation; `compute` is a new closure every render.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return useQuery({
    queryKey: ['aws-lambda-mock', version, ...key],
    queryFn: () =>
      new Promise<T>(resolve => {
        setTimeout(() => resolve(compute()), 150 + Math.random() * 300);
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 60_000,
  });
}

/** Re-renders every second, for "updated 3s ago" labels. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
