import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useLocation} from 'sentry/utils/useLocation';
import {
  usePersistedLogsPageParams,
  type PersistedLogsPageParams,
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_CURSOR_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  getReadableQueryParamsFromLocation,
  isDefaultFields,
  LOGS_AGGREGATE_FIELD_KEY,
} from 'sentry/views/explore/logs/logsQueryParams';
import {useOurLogsTableExpando} from 'sentry/views/explore/logs/tables/useOurLogsTableExpando';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const LOGS_MODE_KEY = 'mode';

const logsQueryStateParsers = {
  [LOGS_MODE_KEY]: parseAsString,
  [LOGS_QUERY_KEY]: parseAsString,
  [LOGS_CURSOR_KEY]: parseAsString,
  [LOGS_FIELDS_KEY]: parseAsArrayOf(parseAsString),
  [LOGS_SORT_BYS_KEY]: parseAsArrayOf(parseAsString),
  [LOGS_AGGREGATE_CURSOR_KEY]: parseAsString,
  [LOGS_AGGREGATE_FIELD_KEY]: parseAsArrayOf(parseAsString),
  [LOGS_AGGREGATE_SORT_BYS_KEY]: parseAsArrayOf(parseAsString),
  [LOGS_GROUP_BY_KEY]: parseAsArrayOf(parseAsString),
  [LOGS_AGGREGATE_FN_KEY]: parseAsString,
  [LOGS_AGGREGATE_PARAM_KEY]: parseAsString,
};

interface LogsLocationQueryParamsProviderProps {
  children: ReactNode;
  // Will override the frozen params from the location if the key is provided.
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function LogsLocationQueryParamsProvider({
  children,
  frozenParams,
}: LogsLocationQueryParamsProviderProps) {
  const location = useLocation();
  const ourlogsTableExpando = useOurLogsTableExpando();

  const [_, setNuqsParams] = useQueryStates(logsQueryStateParsers);
  const [__, setPersistentParams] = usePersistedLogsPageParams();

  const _readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(!ourlogsTableExpando, location),
    [location, ourlogsTableExpando]
  );

  const readableQueryParams = useMemo(
    () =>
      frozenParams ? _readableQueryParams.replace(frozenParams) : _readableQueryParams,
    [_readableQueryParams, frozenParams]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const toPersist: Partial<PersistedLogsPageParams> = {};

      const sortBys = writableQueryParams.sortBys;
      if (defined(sortBys)) {
        toPersist.sortBys = sortBys;
      }

      if (!isEmptyObject(toPersist)) {
        setPersistentParams(prev => ({
          ...prev,
          ...toPersist,
        }));
      }

      const nuqsUpdate: Parameters<typeof setNuqsParams>[0] = {};

      if (writableQueryParams.mode !== undefined) {
        nuqsUpdate[LOGS_MODE_KEY] = writableQueryParams.mode;
      }

      if (writableQueryParams.query !== undefined) {
        nuqsUpdate[LOGS_QUERY_KEY] = writableQueryParams.query;
      }

      if (writableQueryParams.cursor !== undefined) {
        nuqsUpdate[LOGS_CURSOR_KEY] = writableQueryParams.cursor;
      }

      if (writableQueryParams.fields !== undefined) {
        nuqsUpdate[LOGS_FIELDS_KEY] =
          writableQueryParams.fields === null
            ? null
            : writableQueryParams.fields.filter(Boolean);
      }

      if (writableQueryParams.sortBys !== undefined) {
        nuqsUpdate[LOGS_SORT_BYS_KEY] =
          writableQueryParams.sortBys === null
            ? null
            : writableQueryParams.sortBys.map(
                (sort: Sort) => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
              );
      }

      if (writableQueryParams.aggregateCursor !== undefined) {
        nuqsUpdate[LOGS_AGGREGATE_CURSOR_KEY] = writableQueryParams.aggregateCursor;
      }

      if (writableQueryParams.aggregateFields !== undefined) {
        nuqsUpdate[LOGS_AGGREGATE_FIELD_KEY] =
          writableQueryParams.aggregateFields === null
            ? null
            : writableQueryParams.aggregateFields.map(aggregateField =>
                JSON.stringify(aggregateField)
              );

        // When using aggregate fields, delete the separate group by, aggregate fn and param keys
        nuqsUpdate[LOGS_GROUP_BY_KEY] = null;
        nuqsUpdate[LOGS_AGGREGATE_FN_KEY] = null;
        nuqsUpdate[LOGS_AGGREGATE_PARAM_KEY] = null;
      }

      if (writableQueryParams.aggregateSortBys !== undefined) {
        nuqsUpdate[LOGS_AGGREGATE_SORT_BYS_KEY] =
          writableQueryParams.aggregateSortBys === null
            ? null
            : writableQueryParams.aggregateSortBys.map(
                (sort: Sort) => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
              );
      }

      setNuqsParams(nuqsUpdate);
    },
    [setNuqsParams, setPersistentParams]
  );

  const isUsingDefaultFields = isDefaultFields(location);

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={isUsingDefaultFields}
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      shouldManageFields
    >
      {children}
    </QueryParamsContextProvider>
  );
}
