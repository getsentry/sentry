import type {ReactNode} from 'react';
import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface QueryParamsContextValue {
  queryParams: ReadableQueryParams;
  setQueryParams: (queryParams: WritableQueryParams) => void;
}

const [_QueryParamsContextProvider, _useQueryParamsContext, QueryParamsContext] =
  createDefinedContext<QueryParamsContextValue>({
    name: 'QueryParamsContext',
  });

interface QueryParamsContextProps extends QueryParamsContextValue {
  children: ReactNode;
}

export function QueryParamsContextProvider({
  children,
  queryParams,
  setQueryParams,
}: QueryParamsContextProps) {
  const value = useMemo(() => {
    return {
      queryParams,
      setQueryParams,
    };
  }, [queryParams, setQueryParams]);
  return <QueryParamsContext value={value}>{children}</QueryParamsContext>;
}
