import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {getNewQueryParams} from 'sentry/components/pageFilters/actions';
import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  QueryParamsContextProvider,
  type SetQueryParamsOptions,
} from 'sentry/views/explore/queryParams/context';
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
    (
      writableQueryParams: WritableQueryParams,
      {pageFilters}: SetQueryParamsOptions = {}
    ) => {
      onSetWritableQueryParams?.(writableQueryParams);

      let target = getTargetWithReadableQueryParams(location, writableQueryParams);

      if (pageFilters) {
        target = {
          ...target,
          query: getNewQueryParams(
            {
              project: pageFilters.projects,
              environment: pageFilters.environments,
              ...pageFilters.datetime,
            },
            target.query
          ),
        };
      }

      navigateIfQueryChanged(navigate, location, target);
    },
    [location, navigate, getTargetWithReadableQueryParams, onSetWritableQueryParams]
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
