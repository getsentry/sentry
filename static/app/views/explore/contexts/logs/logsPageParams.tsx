import {useCallback, useLayoutEffect, useState} from 'react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import {defined} from 'sentry/utils';
import type {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {Sort} from 'sentry/utils/discover/fields';
import localStorage from 'sentry/utils/localStorage';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {useQueryClient} from 'sentry/utils/queryClient';
import {decodeBoolean, decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  defaultLogFields,
  getLogFieldsFromLocation,
} from 'sentry/views/explore/contexts/logs/fields';
import {
  getLogAggregateSortBysFromLocation,
  getLogSortBysFromLocation,
  logsTimestampDescendingSortBy,
  updateLocationWithAggregateSortBys,
  updateLocationWithLogSortBys,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useLogsQueryKeyWithInfinite} from 'sentry/views/explore/logs/useLogsQuery';

const LOGS_PARAMS_VERSION = 2;
export const LOGS_QUERY_KEY = 'logsQuery'; // Logs may exist on other pages.
export const LOGS_CURSOR_KEY = 'logsCursor';
export const LOGS_AGGREGATE_CURSOR_KEY = 'logsAggregateCursor';
export const LOGS_FIELDS_KEY = 'logsFields';
export const LOGS_AGGREGATE_FN_KEY = 'logsAggregate'; // e.g., p99
export const LOGS_AGGREGATE_PARAM_KEY = 'logsAggregateParam'; // e.g., message.parameters.0
export const LOGS_GROUP_BY_KEY = 'logsGroupBy'; // e.g., message.template

const LOGS_AUTO_REFRESH_KEY = 'live';
const LOGS_REFRESH_INTERVAL_KEY = 'refreshEvery';
const LOGS_REFRESH_INTERVAL_DEFAULT = 5000;

interface LogsPageParams {
  /** In the 'aggregates' table, if you GROUP BY, there can be many rows. This is the cursor for pagination there. */
  readonly aggregateCursor: string;
  /** In the 'aggregates' table, if you GROUP BY, there can be many rows. This is the 'sort by' for that table. */
  readonly aggregateSortBys: Sort[];
  readonly analyticsPageSource: LogsAnalyticsPageSource;
  readonly autoRefresh: boolean;
  readonly blockRowExpanding: boolean | undefined;
  readonly cursor: string;
  readonly fields: string[];
  readonly isTableFrozen: boolean | undefined;
  readonly refreshInterval: number;
  readonly search: MutableSearch;
  /**
   * See setSearchForFrozenPages
   */
  readonly setCursorForFrozenPages: (cursor: string) => void;
  /**
   * On frozen pages (like the issues page), we don't want to store the search in the URL
   * Instead, use a useState in the context, so that it's dropped if you navigate away or refresh.
   */
  readonly setSearchForFrozenPages: (val: MutableSearch) => void;

  /**
   * E.g., -timestamp
   */
  readonly sortBys: Sort[];

  /**
   * E.g., p99
   */
  readonly aggregateFn?: string;
  /**
   * E.g., message.parameters.0
   */
  readonly aggregateParam?: string;
  /**
   * The base search, which doesn't appear in the URL or the search bar, used for adding traceid etc.
   */
  readonly baseSearch?: MutableSearch;

  /**
   * E.g., message.template
   */
  readonly groupBy?: string;

  /**
   * If provided, add a 'trace:{trace id}' to all queries.
   * Used in embedded views like error page and trace page
   */
  readonly limitToTraceId?: string;

  /**
   * If provided, ignores the project in the location and uses the provided project IDs.
   * Useful for cross-project traces when project is in the location.
   */
  readonly projectIds?: number[];
}

type NullablePartial<T> = {
  [P in keyof T]?: T[P] | null;
};
type LogPageParamsUpdate = NullablePartial<LogsPageParams>;

const [_LogsPageParamsProvider, _useLogsPageParams, LogsPageParamsContext] =
  createDefinedContext<LogsPageParams>({
    name: 'LogsPageParamsContext',
  });

interface LogsPageParamsProviderProps {
  analyticsPageSource: LogsAnalyticsPageSource;
  children: React.ReactNode;
  _testContext?: Partial<LogsPageParams>;
  blockRowExpanding?: boolean;
  isTableFrozen?: boolean;
  limitToProjectIds?: number[];
  limitToSpanId?: string;
  limitToTraceId?: string;
}

export function LogsPageParamsProvider({
  children,
  limitToTraceId,
  limitToSpanId,
  limitToProjectIds,
  blockRowExpanding,
  isTableFrozen,
  analyticsPageSource,
  _testContext,
}: LogsPageParamsProviderProps) {
  const location = useLocation();
  const logsQuery = decodeLogsQuery(location);

  const autoRefresh = decodeBoolean(location.query[LOGS_AUTO_REFRESH_KEY]) ?? false;
  const refreshInterval = decodeInteger(
    location.query[LOGS_REFRESH_INTERVAL_KEY],
    LOGS_REFRESH_INTERVAL_DEFAULT
  );

  // on embedded pages with search bars, use a useState instead of a URL parameter
  const [searchForFrozenPages, setSearchForFrozenPages] = useState(new MutableSearch(''));
  const [cursorForFrozenPages, setCursorForFrozenPages] = useState('');

  const search = isTableFrozen ? searchForFrozenPages : new MutableSearch(logsQuery);
  let baseSearch: MutableSearch | undefined = undefined;
  if (limitToSpanId && limitToTraceId) {
    baseSearch = baseSearch ?? new MutableSearch('');
    baseSearch.addFilterValue(OurLogKnownFieldKey.TRACE_ID, limitToTraceId);
    baseSearch.addFilterValue(OurLogKnownFieldKey.PARENT_SPAN_ID, limitToSpanId);
  } else if (limitToTraceId) {
    baseSearch = baseSearch ?? new MutableSearch('');
    baseSearch.addFilterValue(OurLogKnownFieldKey.TRACE_ID, limitToTraceId);
  }
  const fields = isTableFrozen ? defaultLogFields() : getLogFieldsFromLocation(location);
  const sortBys = isTableFrozen
    ? [logsTimestampDescendingSortBy]
    : getLogSortBysFromLocation(location, fields);
  const groupBy = isTableFrozen
    ? undefined
    : decodeScalar(location.query[LOGS_GROUP_BY_KEY]);
  const aggregateFn = isTableFrozen
    ? undefined
    : (decodeScalar(location.query[LOGS_AGGREGATE_FN_KEY]) ?? 'count');
  const _aggregateParam = isTableFrozen
    ? undefined
    : decodeScalar(location.query[LOGS_AGGREGATE_PARAM_KEY]);
  const aggregateParam =
    aggregateFn === 'count' && !_aggregateParam
      ? OurLogKnownFieldKey.MESSAGE
      : _aggregateParam;
  const aggregate = `${aggregateFn}(${aggregateParam})`;
  const aggregateSortBys = getLogAggregateSortBysFromLocation(location, [
    ...(groupBy ? [groupBy] : []),
    aggregate,
  ]);
  const pageFilters = usePageFilters();
  const projectIds = isTableFrozen
    ? (limitToProjectIds ?? [-1])
    : pageFilters.selection.projects;
  // TODO we should handle environments in a similar way to projects - otherwise page filters might break embedded views

  const cursor = isTableFrozen
    ? cursorForFrozenPages
    : getLogCursorFromLocation(location);
  const aggregateCursor = getLogAggregateCursorFromLocation(location);

  return (
    <LogsPageParamsContext
      value={{
        aggregateCursor,
        aggregateSortBys,
        fields,
        search,
        setSearchForFrozenPages,
        sortBys,
        cursor,
        setCursorForFrozenPages,
        isTableFrozen,
        autoRefresh,
        refreshInterval,
        blockRowExpanding,
        baseSearch,
        projectIds,
        analyticsPageSource,
        limitToTraceId,
        groupBy,
        aggregateFn,
        aggregateParam,
        ..._testContext,
      }}
    >
      {children}
    </LogsPageParamsContext>
  );
}

const useLogsPageParams = _useLogsPageParams;

const decodeLogsQuery = (location: Location): string => {
  if (!location.query?.[LOGS_QUERY_KEY]) {
    return '';
  }

  const queryParameter = location.query[LOGS_QUERY_KEY];

  return decodeScalar(queryParameter, '').trim();
};

function setLogsPageParams(location: Location, pageParams: LogPageParamsUpdate) {
  const target: Location = {...location, query: {...location.query}};
  updateNullableLocation(target, LOGS_QUERY_KEY, pageParams.search?.formatString());
  updateNullableLocation(target, LOGS_CURSOR_KEY, pageParams.cursor);
  updateNullableLocation(target, LOGS_AGGREGATE_CURSOR_KEY, pageParams.aggregateCursor);
  updateNullableLocation(target, LOGS_FIELDS_KEY, pageParams.fields);
  updateNullableLocation(target, LOGS_GROUP_BY_KEY, pageParams.groupBy);
  updateNullableLocation(target, LOGS_AGGREGATE_FN_KEY, pageParams.aggregateFn);
  updateNullableLocation(target, LOGS_AGGREGATE_PARAM_KEY, pageParams.aggregateParam);
  if (!pageParams.isTableFrozen) {
    updateLocationWithLogSortBys(target, pageParams.sortBys);
    if (
      pageParams.sortBys ||
      pageParams.search ||
      pageParams.aggregateFn ||
      pageParams.aggregateParam ||
      pageParams.groupBy
    ) {
      updateLocationWithAggregateSortBys(target, pageParams.aggregateSortBys);
    }
    if (pageParams.sortBys || pageParams.aggregateSortBys || pageParams.search) {
      // make sure to clear the cursor every time the query is updated
      delete target.query[LOGS_CURSOR_KEY];
      delete target.query[LOGS_AUTO_REFRESH_KEY];
    }
  }
  updateNullableLocation(target, LOGS_AUTO_REFRESH_KEY, pageParams.autoRefresh);
  return target;
}

/**
 * Allows updating a location field, removing it if the value is null.
 *
 * Return true if the location field was updated, in case of side effects.
 */
function updateNullableLocation(
  location: Location,
  key: string,
  value: boolean | string | string[] | null | undefined
): boolean {
  if (typeof value === 'boolean') {
    if (value) {
      location.query[key] = 'true';
    } else {
      // Delete boolean keys to minimize the number of query params.
      delete location.query[key];
    }
    return true;
  }
  if (defined(value) && location.query[key] !== value) {
    location.query[key] = value;
    return true;
  }
  if (value === null && location.query[key]) {
    delete location.query[key];
    return true;
  }
  return false;
}

export function useSetLogsPageParams() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (pageParams: LogPageParamsUpdate) => {
      const target = setLogsPageParams(location, pageParams);
      navigate(target);
    },
    [location, navigate]
  );
}

export function useLogsSearch(): MutableSearch {
  const {search} = useLogsPageParams();
  return search;
}

export function useLogsBaseSearch(): MutableSearch | undefined {
  const {baseSearch} = useLogsPageParams();
  return baseSearch;
}

export function useSetLogsSearch() {
  const setPageParams = useSetLogsPageParams();
  const {setSearchForFrozenPages, isTableFrozen} = useLogsPageParams();
  const setPageParamsCallback = useCallback(
    (search: MutableSearch) => {
      setPageParams({search});
    },
    [setPageParams]
  );
  if (isTableFrozen) {
    return setSearchForFrozenPages;
  }
  return setPageParamsCallback;
}

export function useLogsCursor() {
  const {cursor} = useLogsPageParams();
  return cursor;
}

export function useLogsAggregateFunction() {
  const {aggregateFn} = useLogsPageParams();
  return aggregateFn;
}

export function useLogsAggregateParam() {
  const {aggregateParam} = useLogsPageParams();
  return aggregateParam;
}

export function useLogsAggregate() {
  const aggregateFn = useLogsAggregateFunction();
  const aggregateParam = useLogsAggregateParam();
  return `${aggregateFn}(${aggregateParam})`;
}

export function useLogsGroupBy() {
  const {groupBy} = useLogsPageParams();
  return groupBy;
}

export function useLogsIsFrozen() {
  const {isTableFrozen} = useLogsPageParams();
  return !!isTableFrozen;
}

export function useLogsLimitToTraceId() {
  const {limitToTraceId} = useLogsPageParams();
  return limitToTraceId;
}

export function useSetLogsCursor() {
  const setPageParams = useSetLogsPageParams();
  const {setCursorForFrozenPages, isTableFrozen} = useLogsPageParams();
  return useCallback<CursorHandler>(
    cursor => {
      if (isTableFrozen) {
        setCursorForFrozenPages(cursor ?? '');
      } else {
        setPageParams({cursor});
      }
    },
    [isTableFrozen, setCursorForFrozenPages, setPageParams]
  );
}

export function useLogsIsTableFrozen() {
  const {isTableFrozen} = useLogsPageParams();
  return !!isTableFrozen;
}

export function useLogsBlockRowExpanding() {
  const {blockRowExpanding} = useLogsPageParams();
  return !!blockRowExpanding;
}

export function usePersistedLogsPageParams() {
  useLayoutEffect(() => {
    const pastParams = localStorage.getItem(
      getPastLogsParamsStorageKey(LOGS_PARAMS_VERSION)
    );
    if (pastParams) {
      localStorage.removeItem(getPastLogsParamsStorageKey(LOGS_PARAMS_VERSION));
    }
  });

  return useLocalStorageState(getLogsParamsStorageKey(LOGS_PARAMS_VERSION), {
    fields: defaultLogFields() as string[],
    sortBys: [logsTimestampDescendingSortBy],
  });
}

export function useLogsAggregateSortBys() {
  const {aggregateSortBys} = useLogsPageParams();
  return aggregateSortBys;
}

export function useLogsAggregateCursor() {
  const {aggregateCursor} = useLogsPageParams();
  return aggregateCursor;
}

export function useLogsSortBys() {
  const {sortBys} = useLogsPageParams();
  return sortBys;
}

export function useLogsFields() {
  const {fields} = useLogsPageParams();
  return fields;
}

export function useLogsProjectIds() {
  const {projectIds} = useLogsPageParams();
  return projectIds;
}

export function useSetLogsFields() {
  const setPageParams = useSetLogsPageParams();

  const [_, setPersistentParams] = usePersistedLogsPageParams();

  return useCallback(
    (fields: string[]) => {
      setPageParams({fields});
      setPersistentParams(prev => ({...prev, fields}));
    },
    [setPageParams, setPersistentParams]
  );
}

interface ToggleableSortBy {
  field: string;
  defaultDirection?: 'asc' | 'desc'; // Defaults to descending if not provided.
  kind?: 'asc' | 'desc';
}

export function useSetLogsSortBys() {
  const setPageParams = useSetLogsPageParams();
  const [_, setPersistentParams] = usePersistedLogsPageParams();
  const currentPageSortBys = useLogsSortBys();

  return useCallback(
    (desiredSortBys: ToggleableSortBy[]) => {
      const targetSortBys: Sort[] = desiredSortBys.map(desiredSortBy => {
        const currentSortBy = currentPageSortBys.find(
          s => s.field === desiredSortBy.field
        );
        const reverseDirection = currentSortBy?.kind === 'asc' ? 'desc' : 'asc';
        return {
          field: desiredSortBy.field,
          kind:
            desiredSortBy.kind ??
            reverseDirection ??
            desiredSortBy.defaultDirection ??
            'desc',
        };
      });

      setPersistentParams(prev => ({...prev, sortBys: targetSortBys}));
      setPageParams({sortBys: targetSortBys});
    },
    [setPageParams, setPersistentParams, currentPageSortBys]
  );
}

export function useLogsAnalyticsPageSource() {
  const {analyticsPageSource} = useLogsPageParams();
  return analyticsPageSource;
}

function getLogCursorFromLocation(location: Location): string {
  if (!location.query?.[LOGS_CURSOR_KEY]) {
    return '';
  }

  return decodeScalar(location.query[LOGS_CURSOR_KEY], '');
}

function getLogAggregateCursorFromLocation(location: Location): string {
  if (!location.query?.[LOGS_AGGREGATE_CURSOR_KEY]) {
    return '';
  }

  return decodeScalar(location.query[LOGS_AGGREGATE_CURSOR_KEY], '');
}

export function stripLogParamsFromLocation(location: Location): Location {
  const target: Location = {...location, query: {...location.query}};
  delete target.query[LOGS_CURSOR_KEY];
  delete target.query[LOGS_FIELDS_KEY];
  delete target.query[LOGS_QUERY_KEY];
  return target;
}

function getLogsParamsStorageKey(version: number) {
  return `logs-params-v${version}`;
}

function getPastLogsParamsStorageKey(version: number) {
  return `logs-params-v${version - 1}`;
}

export function useLogsAutoRefresh() {
  const {autoRefresh, isTableFrozen} = useLogsPageParams();
  return isTableFrozen ? false : autoRefresh;
}

export function useSetLogsAutoRefresh() {
  const setPageParams = useSetLogsPageParams();
  const {queryKey} = useLogsQueryKeyWithInfinite({
    referrer: 'api.explore.logs-table',
    autoRefresh: false,
  });
  const queryClient = useQueryClient();
  return useCallback(
    (autoRefresh: boolean) => {
      if (autoRefresh) {
        queryClient.removeQueries({queryKey});
      }
      setPageParams({autoRefresh});
    },
    [setPageParams, queryClient, queryKey]
  );
}

export function useLogsRefreshInterval() {
  const {refreshInterval} = useLogsPageParams();
  return refreshInterval;
}
