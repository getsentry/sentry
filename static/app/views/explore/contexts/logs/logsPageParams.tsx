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
  getLogSortBysFromLocation,
  logsTimestampDescendingSortBy,
  updateLocationWithLogSortBys,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useLogsQueryKeyWithInfinite} from 'sentry/views/explore/logs/useLogsQuery';

const LOGS_PARAMS_VERSION = 1;
export const LOGS_QUERY_KEY = 'logsQuery'; // Logs may exist on other pages.
export const LOGS_CURSOR_KEY = 'logsCursor';
export const LOGS_FIELDS_KEY = 'logsFields';

const LOGS_AUTO_REFRESH_KEY = 'live';
const LOGS_REFRESH_INTERVAL_KEY = 'refreshEvery';
const LOGS_REFRESH_INTERVAL_DEFAULT = 5000;

interface LogsPageParams {
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
  readonly sortBys: Sort[];
  /**
   * The base search, which doesn't appear in the URL or the search bar, used for adding traceid etc.
   */
  readonly baseSearch?: MutableSearch;
  /**
   * If provided, ignores the project in the location and uses the provided project IDs.
   * Useful for cross-project traces when project is in the location.
   */
  readonly projectIds?: number[];
}

type LogPageParamsUpdate = Partial<LogsPageParams>;

const [_LogsPageParamsProvider, _useLogsPageParams, LogsPageParamsContext] =
  createDefinedContext<LogsPageParams>({
    name: 'LogsPageParamsContext',
  });

interface LogsPageParamsProviderProps {
  analyticsPageSource: LogsAnalyticsPageSource;
  children: React.ReactNode;
  blockRowExpanding?: boolean;
  isTableFrozen?: boolean;
  limitToProjectIds?: number[];
  limitToSpanId?: string;
  limitToTraceId?: string | string[];
}

export function LogsPageParamsProvider({
  children,
  limitToTraceId,
  limitToSpanId,
  limitToProjectIds,
  blockRowExpanding,
  isTableFrozen,
  analyticsPageSource,
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

  // Handle trace IDs - convert to array if single value
  const traceIds = Array.isArray(limitToTraceId)
    ? limitToTraceId
    : limitToTraceId
      ? [limitToTraceId]
      : undefined;

  if (traceIds?.length) {
    baseSearch = baseSearch ?? new MutableSearch('');
    // Use square bracket notation for multiple trace IDs
    const traceIdValue = `[${traceIds.join(',')}]`;
    if (traceIdValue) {
      baseSearch.addFilterValue(OurLogKnownFieldKey.TRACE_ID, traceIdValue);
      if (limitToSpanId) {
        baseSearch.addFilterValue(OurLogKnownFieldKey.PARENT_SPAN_ID, limitToSpanId);
      }
    }
  }

  const fields = isTableFrozen ? defaultLogFields() : getLogFieldsFromLocation(location);
  const sortBys = isTableFrozen
    ? [logsTimestampDescendingSortBy]
    : getLogSortBysFromLocation(location, fields);
  const pageFilters = usePageFilters();
  const projectIds = isTableFrozen
    ? (limitToProjectIds ?? [-1])
    : pageFilters.selection.projects;
  // TODO we should handle environments in a similar way to projects - otherwise page filters might break embedded views

  const cursor = isTableFrozen
    ? cursorForFrozenPages
    : getLogCursorFromLocation(location);

  return (
    <LogsPageParamsContext
      value={{
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
  updateNullableLocation(target, LOGS_FIELDS_KEY, pageParams.fields);
  updateNullableLocation(target, LOGS_AUTO_REFRESH_KEY, pageParams.autoRefresh);
  if (!pageParams.isTableFrozen) {
    updateLocationWithLogSortBys(target, pageParams.sortBys);
    if (pageParams.sortBys || pageParams.search) {
      delete target.query[LOGS_CURSOR_KEY];
      delete target.query[LOGS_AUTO_REFRESH_KEY];
    }
  }
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

export function useSetLogsSortBys() {
  const setPageParams = useSetLogsPageParams();
  const currentPageSortBys = useLogsSortBys();
  const [_, setPersistentParams] = usePersistedLogsPageParams();

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
    [setPageParams, currentPageSortBys, setPersistentParams]
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
  const {queryKey} = useLogsQueryKeyWithInfinite({referrer: 'api.explore.logs-table'});
  const queryClient = useQueryClient();
  return useCallback(
    (autoRefresh: boolean) => {
      setPageParams({autoRefresh});
      if (autoRefresh) {
        queryClient.removeQueries({queryKey});
      }
    },
    [setPageParams, queryClient, queryKey]
  );
}

export function useLogsRefreshInterval() {
  const {refreshInterval} = useLogsPageParams();
  return refreshInterval;
}

interface ToggleableSortBy {
  field: string;
  defaultDirection?: 'asc' | 'desc'; // Defaults to descending if not provided.
  kind?: 'asc' | 'desc';
}
