import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
import {getQueryFromLocation} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const REPLAY_QUERY_KEY = 'query';

function getReadableQueryParamsFromLocation(location: Location): ReadableQueryParams {
  const query = getQueryFromLocation(location, REPLAY_QUERY_KEY) ?? '';

  return new ReadableQueryParams({
    extrapolate: false,
    mode: Mode.SAMPLES,
    query,
    cursor: '',
    fields: [],
    sortBys: [],
    aggregateCursor: '',
    aggregateFields: [],
    aggregateSortBys: [],
  });
}

function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  updateNullableLocation(target, REPLAY_QUERY_KEY, writableQueryParams.query);

  return target;
}

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
