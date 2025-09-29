import {useLayoutEffect, useState} from 'react';
import type {Location} from 'history';

import type {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {Sort} from 'sentry/utils/discover/fields';
import localStorage from 'sentry/utils/localStorage';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {
  defaultLogFields,
  getLogFieldsFromLocation,
} from 'sentry/views/explore/contexts/logs/fields';
import {
  getLogAggregateSortBysFromLocation,
  getLogSortBysFromLocation,
  logsTimestampDescendingSortBy,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  getModeFromLocation,
  type Mode,
} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const LOGS_PARAMS_VERSION = 2;
export const LOGS_QUERY_KEY = 'logsQuery'; // Logs may exist on other pages.
export const LOGS_CURSOR_KEY = 'logsCursor';
export const LOGS_AGGREGATE_CURSOR_KEY = 'logsAggregateCursor';
export const LOGS_FIELDS_KEY = 'logsFields';
export const LOGS_AGGREGATE_FN_KEY = 'logsAggregate'; // e.g., p99
export const LOGS_AGGREGATE_PARAM_KEY = 'logsAggregateParam'; // e.g., message.parameters.0
export const LOGS_GROUP_BY_KEY = 'logsGroupBy'; // e.g., message.template

interface LogsPageParams {
  /** In the 'aggregates' table, if you GROUP BY, there can be many rows. This is the cursor for pagination there. */
  readonly aggregateCursor: string;
  /** In the 'aggregates' table, if you GROUP BY, there can be many rows. This is the 'sort by' for that table. */
  readonly aggregateSortBys: Sort[];
  readonly analyticsPageSource: LogsAnalyticsPageSource;
  readonly cursor: string;
  readonly fields: string[];
  readonly isTableFrozen: boolean | undefined;
  readonly mode: Mode;
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
   * E.g., message.template
   */
  readonly groupBy?: string;

  /**
   * The id of the query, if a saved query.
   */
  readonly id?: string;

  /**
   * The title of the query, if a saved query.
   */
  readonly title?: string;
}

const [_LogsPageParamsProvider, _useLogsPageParams, LogsPageParamsContext] =
  createDefinedContext<LogsPageParams>({
    name: 'LogsPageParamsContext',
  });

interface LogsPageParamsProviderProps {
  analyticsPageSource: LogsAnalyticsPageSource;
  children: React.ReactNode;
  isTableFrozen?: boolean;
}

export function LogsPageParamsProvider({
  children,
  isTableFrozen,
  analyticsPageSource,
}: LogsPageParamsProviderProps) {
  const location = useLocation();
  const logsQuery = decodeLogsQuery(location);

  // on embedded pages with search bars, use a useState instead of a URL parameter
  const [searchForFrozenPages, setSearchForFrozenPages] = useState(new MutableSearch(''));
  const [cursorForFrozenPages, setCursorForFrozenPages] = useState('');

  const search = isTableFrozen ? searchForFrozenPages : new MutableSearch(logsQuery);

  const title = getLogTitleFromLocation(location);
  const id = getLogIdFromLocation(location);
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
  const mode = getModeFromLocation(location);
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
        title,
        id,
        cursor,
        setCursorForFrozenPages,
        isTableFrozen,
        analyticsPageSource,
        groupBy,
        aggregateFn,
        aggregateParam,
        mode,
      }}
    >
      {children}
    </LogsPageParamsContext>
  );
}

const decodeLogsQuery = (location: Location): string => {
  if (!location.query?.[LOGS_QUERY_KEY]) {
    return '';
  }

  const queryParameter = location.query[LOGS_QUERY_KEY];

  return decodeScalar(queryParameter, '').trim();
};

export interface PersistedLogsPageParams {
  fields: string[];
  sortBys: Sort[];
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

  return useLocalStorageState<PersistedLogsPageParams>(
    getLogsParamsStorageKey(LOGS_PARAMS_VERSION),
    {
      fields: defaultLogFields() as string[],
      sortBys: [logsTimestampDescendingSortBy],
    }
  );
}

function getLogTitleFromLocation(location: Location): string {
  return decodeScalar(location.query.title, '');
}

function getLogIdFromLocation(location: Location): string {
  return decodeScalar(location.query.id, '');
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
