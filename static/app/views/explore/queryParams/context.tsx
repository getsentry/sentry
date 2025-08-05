import type {ReactNode} from 'react';
import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface QueryParamsContextValue {
  queryParams: ReadableQueryParams;
  setQueryParams: (queryParams: WritableQueryParams) => void;
}

const [_QueryParamsContextProvider, useQueryParamsContext, QueryParamsContext] =
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

export function useQueryParamsMode(): Mode {
  const {queryParams} = useQueryParamsContext();
  return queryParams.mode;
}
