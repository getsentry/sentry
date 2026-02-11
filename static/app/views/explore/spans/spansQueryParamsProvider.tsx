import type {ReactNode} from 'react';
import {useCallback, useMemo, useRef} from 'react';
import type {Location} from 'history';

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

function isSameLocation(a: Location, b: Location): boolean {
  if (a.pathname !== b.pathname) {
    return false;
  }
  return JSON.stringify(a.query) === JSON.stringify(b.query);
}

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  // Store location in a ref so we can access the latest value without including
  // it in the dependency array. This makes setWritableQueryParams stable and
  // prevents unnecessary context updates.
  const locationRef = useRef(location);
  locationRef.current = location;

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location, organization),
    [location, organization]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const target = getTargetWithReadableQueryParams(
        locationRef.current,
        writableQueryParams
      );

      // Only navigate if the target URL is different from current location
      // This prevents duplicate history entries which can cause browser back button issues
      if (!isSameLocation(locationRef.current, target)) {
        navigate(target);
      }
    },
    [navigate]
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
