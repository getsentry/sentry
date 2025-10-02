import {useLayoutEffect} from 'react';
import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
import localStorage from 'sentry/utils/localStorage';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {logsTimestampDescendingSortBy} from 'sentry/views/explore/contexts/logs/sortBys';

const LOGS_PARAMS_VERSION = 2;
export const LOGS_QUERY_KEY = 'logsQuery'; // Logs may exist on other pages.
export const LOGS_CURSOR_KEY = 'logsCursor';
export const LOGS_AGGREGATE_CURSOR_KEY = 'logsAggregateCursor';
export const LOGS_FIELDS_KEY = 'logsFields';
export const LOGS_AGGREGATE_FN_KEY = 'logsAggregate'; // e.g., p99
export const LOGS_AGGREGATE_PARAM_KEY = 'logsAggregateParam'; // e.g., message.parameters.0
export const LOGS_GROUP_BY_KEY = 'logsGroupBy'; // e.g., message.template

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
