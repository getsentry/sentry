import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import {useQueryStates} from 'nuqs';

import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {
  LOGS_FIELDS_KEY,
  usePersistedLogsPageParams,
  type PersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  getLogsQueryParamsUpdate,
  getReadableQueryParamsFromParsed,
  logsQueryParamsParsers,
} from 'sentry/views/explore/logs/logsQueryParams';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface LogsLocationQueryParamsProviderProps {
  children: ReactNode;
  // Will override the frozen params from the location if the key is provided.
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function LogsLocationQueryParamsProvider({
  children,
  frozenParams,
}: LogsLocationQueryParamsProviderProps) {
  const [queryParams, setNuqsParams] = useQueryStates(logsQueryParamsParsers, {
    history: 'push',
  });

  const [_, setPersistentParams] = usePersistedLogsPageParams();

  const _readableQueryParams = useMemo(
    () => getReadableQueryParamsFromParsed(false, queryParams),
    [queryParams]
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

      setNuqsParams(getLogsQueryParamsUpdate(writableQueryParams));
    },
    [setNuqsParams, setPersistentParams]
  );

  const isUsingDefaultFields = !queryParams[LOGS_FIELDS_KEY];

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
