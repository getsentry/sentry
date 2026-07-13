import type {ReactNode} from 'react';
import {useCallback, useMemo, useRef} from 'react';
import type {Location} from 'history';

import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {
  ReadableQueryParams,
  ReadableQueryParamsOptions,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface ExploreLocationQueryParamsProviderProps {
  children: ReactNode;
  getReadableQueryParamsFromLocation: (location: Location) => ReadableQueryParams;
  getTargetWithReadableQueryParams: (
    location: Location,
    writableQueryParams: WritableQueryParams
  ) => Location;
  isDefaultFields: (location: Location) => boolean;
  frozenParams?: Partial<ReadableQueryParamsOptions>;
  // Runs before navigation, e.g. to persist params to local storage.
  onSetWritableQueryParams?: (writableQueryParams: WritableQueryParams) => void;
}

export function ExploreLocationQueryParamsProvider({
  children,
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
  frozenParams,
  onSetWritableQueryParams,
}: ExploreLocationQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Store location in a ref so we can access the latest value without including
  // it in the dependency array. This makes setWritableQueryParams stable and
  // prevents unnecessary context updates.
  const locationRef = useRef(location);
  locationRef.current = location;

  const _readableQueryParams = useMemo(
    () => getReadableQueryParamsFromLocation(location),
    [getReadableQueryParamsFromLocation, location]
  );

  const readableQueryParams = useMemo(
    () =>
      frozenParams ? _readableQueryParams.replace(frozenParams) : _readableQueryParams,
    [_readableQueryParams, frozenParams]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      onSetWritableQueryParams?.(writableQueryParams);

      const target = getTargetWithReadableQueryParams(
        locationRef.current,
        writableQueryParams
      );

      navigateIfQueryChanged(navigate, locationRef.current, target);
    },
    [navigate, getTargetWithReadableQueryParams, onSetWritableQueryParams]
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
