import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location, organization),
    [location, organization]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const target = getTargetWithReadableQueryParams(location, writableQueryParams);
      navigate(target);
    },
    [location, navigate]
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
