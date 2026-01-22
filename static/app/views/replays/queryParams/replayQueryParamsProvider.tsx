import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
} from 'sentry/views/replays/queryParams/replayQueryParams';

interface ReplayQueryParamsProviderProps {
  children: ReactNode;
}

export function ReplayQueryParamsProvider({children}: ReplayQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location),
    [location]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const target = getTargetWithReadableQueryParams(location, writableQueryParams);
      navigate(target);
    },
    [location, navigate]
  );

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}
