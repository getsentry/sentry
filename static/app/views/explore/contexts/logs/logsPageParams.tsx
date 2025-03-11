import {useCallback} from 'react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {getLogFieldsFromLocation} from 'sentry/views/explore/contexts/logs/fields';
import {
  getLogSortBysFromLocation,
  logsTimestampDescendingSortBy,
  updateLocationWithLogSortBys,
} from 'sentry/views/explore/contexts/logs/sortBys';

const LOGS_QUERY_KEY = 'logsQuery'; // Logs may exist on other pages.
const LOGS_CURSOR_KEY = 'logsCursor';
export const LOGS_FIELDS_KEY = 'logsFields';

interface LogsPageParams {
  readonly cursor: string;
  readonly fields: string[];
  readonly isTableSortFrozen: boolean | undefined;
  readonly search: MutableSearch;
  readonly sortBys: Sort[];
}

type LogPageParamsUpdate = Partial<LogsPageParams>;

const [_LogsPageParamsProvider, _useLogsPageParams, LogsPageParamsContext] =
  createDefinedContext<LogsPageParams>({
    name: 'LogsPageParamsContext',
  });

export function LogsPageParamsProvider({
  children,
  traceId,
  isIssuesDetailView,
}: {
  children: React.ReactNode;
  isIssuesDetailView?: boolean;
  traceId?: string;
}) {
  const location = useLocation();
  const logsQuery = decodeLogsQuery(location);
  const search = new MutableSearch(logsQuery);
  const fields = getLogFieldsFromLocation(location);
  const sortBys = isIssuesDetailView
    ? [logsTimestampDescendingSortBy]
    : getLogSortBysFromLocation(location, fields);

  const isTableSortFrozen = isIssuesDetailView;

  const cursor = getLogCursorFromLocation(location);
  if (traceId) {
    search.addFilterValues('trace_id', [traceId]);
  }

  return (
    <LogsPageParamsContext.Provider
      value={{fields, search, sortBys, cursor, isTableSortFrozen}}
    >
      {children}
    </LogsPageParamsContext.Provider>
  );
}

export const useLogsPageParams = _useLogsPageParams;

const decodeLogsQuery = (location: Location): string => {
  if (!location.query || !location.query[LOGS_QUERY_KEY]) {
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
  if (!pageParams.isTableSortFrozen) {
    updateLocationWithLogSortBys(target, pageParams.sortBys, LOGS_CURSOR_KEY);
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
  value: string | string[] | null | undefined
): boolean {
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

export function useSetLogsQuery() {
  const setPageParams = useSetLogsPageParams();
  return useCallback(
    (query: string) => {
      setPageParams({search: new MutableSearch(query)});
    },
    [setPageParams]
  );
}

export function useSetLogsSearch() {
  const setPageParams = useSetLogsPageParams();
  return useCallback(
    (search: MutableSearch) => {
      setPageParams({search});
    },
    [setPageParams]
  );
}

export function useLogsSortBys() {
  const {sortBys} = useLogsPageParams();
  return sortBys;
}

export function useLogsFields() {
  const {fields} = useLogsPageParams();
  return fields;
}

export function useSetLogsFields() {
  const setPageParams = useSetLogsPageParams();
  return useCallback(
    (fields: string[]) => {
      setPageParams({fields});
    },
    [setPageParams]
  );
}

export function useLogsCursor() {
  const {cursor} = useLogsPageParams();
  return cursor;
}

export function useSetLogsCursor() {
  const setPageParams = useSetLogsPageParams();
  return useCallback<CursorHandler>(
    cursor => {
      setPageParams({cursor});
    },
    [setPageParams]
  );
}

export function useSetLogsSortBys() {
  const setPageParams = useSetLogsPageParams();
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

      setPageParams({sortBys: targetSortBys});
    },
    [setPageParams, currentPageSortBys]
  );
}

function getLogCursorFromLocation(location: Location): string {
  if (!location.query || !location.query[LOGS_CURSOR_KEY]) {
    return '';
  }

  return decodeScalar(location.query[LOGS_CURSOR_KEY], '');
}

interface ToggleableSortBy {
  field: string;
  defaultDirection?: 'asc' | 'desc'; // Defaults to descending if not provided.
  kind?: 'asc' | 'desc';
}
