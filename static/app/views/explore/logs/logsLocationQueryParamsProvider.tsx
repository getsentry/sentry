import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  usePersistedLogsPageParams,
  type PersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/logs/logsQueryParams';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface LogsLocationQueryParamsProviderProps {
  children: ReactNode;
  // Will override the frozen params from the location if the key is provided.
  frozenParams?: Partial<ReadableQueryParams>;
}

export function LogsLocationQueryParamsProvider({
  children,
  frozenParams,
}: LogsLocationQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [_, setPersistentParams] = usePersistedLogsPageParams();

  const _readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location),
    [location]
  );

  const readableQueryParams = useMemo(
    () =>
      frozenParams ? {..._readableQueryParams, ...frozenParams} : _readableQueryParams,
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

      const target = getTargetWithReadableQueryParams(location, writableQueryParams);
      navigate(target);
    },
    [location, navigate, setPersistentParams]
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
