import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/logs/logsQueryParams';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface LogsLocationQueryParamsProviderProps {
  children: ReactNode;
}

export function LogsLocationQueryParamsProvider({
  children,
}: LogsLocationQueryParamsProviderProps) {
  const location = useLocation();

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location),
    [location]
  );

  const setWritableQueryParams = useCallback(
    (_writableQueryParams: WritableQueryParams) => {
      // TODO
    },
    []
  );

  return (
    <QueryParamsContextProvider
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
    >
      {children}
    </QueryParamsContextProvider>
  );
}
