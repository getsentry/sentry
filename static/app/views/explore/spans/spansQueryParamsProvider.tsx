import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location, organization),
    [location, organization]
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
