import type {ReactNode} from 'react';
import {useMemo} from 'react';

import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

interface MultiQueryParamsProviderProps {
  children: ReactNode;
}

/**
 * Provides a minimal QueryParamsContext for multi-query mode.
 * Multi-query mode manages its own state via URL parameters, but some hooks
 * still depend on the QueryParamsContext being present (e.g., useCrossEventQueries).
 * This provider ensures those hooks don't throw errors.
 */
export function MultiQueryParamsProvider({children}: MultiQueryParamsProviderProps) {
  const readableQueryParams = useMemo(
    () =>
      new ReadableQueryParams({
        aggregateCursor: defaultCursor(),
        aggregateFields: [],
        aggregateSortBys: [],
        cursor: defaultCursor(),
        extrapolate: true,
        fields: [],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [],
        crossEvents: undefined,
      }),
    []
  );

  const setQueryParams = () => {
    // Multi-query mode doesn't use setQueryParams from context
    // It manages its own state via useReadQueriesFromLocation and related hooks
  };

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={false}
      queryParams={readableQueryParams}
      setQueryParams={setQueryParams}
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}
