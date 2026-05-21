import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface ReplayQueryParamsProviderProps {
  children: ReactNode;
}

export function ReplayQueryParamsProvider({children}: ReplayQueryParamsProviderProps) {
  const [queryParams, setNuqsParams] = useQueryStates({
    query: parseAsString.withDefault(''),
    id: parseAsString,
    title: parseAsString,
  });

  const readableQueryParams = useMemo(
    () =>
      new ReadableQueryParams({
        extrapolate: false,
        mode: Mode.SAMPLES,
        query: queryParams.query,
        cursor: '',
        fields: [],
        sortBys: [],
        aggregateCursor: '',
        aggregateFields: [],
        aggregateSortBys: [],
        id: queryParams.id ?? undefined,
        title: queryParams.title ?? undefined,
      }),
    [queryParams.query, queryParams.id, queryParams.title]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setNuqsParams({
        query: writableQueryParams.query,
      });
    },
    [setNuqsParams]
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
