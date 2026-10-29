import type {ReactNode} from 'react';
import {useCallback, useMemo, useRef} from 'react';
import type {NavigateOptions} from 'react-router';
import type {ParserMap} from 'nuqs';

import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
  type QueryParamsUpdates,
  type QueryParamsValues,
} from 'sentry/views/explore/queryParams/parsers';
import type {
  ReadableQueryParams,
  ReadableQueryParamsOptions,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface ExploreQueryParamsProviderProps<Parsers extends ParserMap> {
  children: ReactNode;
  getQueryParamsUpdates: (
    writableQueryParams: WritableQueryParams
  ) => QueryParamsUpdates<Parsers>;
  getReadableQueryParams: (values: QueryParamsValues<Parsers>) => ReadableQueryParams;
  isDefaultFields: (values: QueryParamsValues<Parsers>) => boolean;
  parsers: Parsers;
  frozenParams?: Partial<ReadableQueryParamsOptions>;
  // Runs before navigation, e.g. to persist params to local storage.
  onSetWritableQueryParams?: (writableQueryParams: WritableQueryParams) => void;
}

export function ExploreQueryParamsProvider<Parsers extends ParserMap>({
  children,
  getQueryParamsUpdates,
  getReadableQueryParams,
  isDefaultFields,
  parsers,
  frozenParams,
  onSetWritableQueryParams,
}: ExploreQueryParamsProviderProps<Parsers>) {
  const location = useLocation();
  const navigate = useNavigate();

  // Store location in a ref so we can access the latest value without including
  // it in the dependency array. This makes setWritableQueryParams stable and
  // prevents unnecessary context updates.
  const locationRef = useRef(location);
  // oxlint-disable-next-line react/refs
  locationRef.current = location;

  const values = useMemo(
    () => loadQueryParamsFromLocation(parsers, location),
    [parsers, location]
  );

  const readableQueryParams = useMemo(() => {
    const readable = getReadableQueryParams(values);
    return frozenParams ? readable.replace(frozenParams) : readable;
  }, [getReadableQueryParams, values, frozenParams]);

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams, options?: NavigateOptions) => {
      onSetWritableQueryParams?.(writableQueryParams);

      const target = applyQueryParamsUpdates(
        parsers,
        locationRef.current,
        getQueryParamsUpdates(writableQueryParams)
      );

      navigateIfQueryChanged(navigate, locationRef.current, target, options);
    },
    [getQueryParamsUpdates, navigate, onSetWritableQueryParams, parsers]
  );

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={isDefaultFields(values)}
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      shouldManageFields
    >
      {children}
    </QueryParamsContextProvider>
  );
}
