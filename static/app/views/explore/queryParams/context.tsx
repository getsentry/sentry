import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
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

function useQueryParams() {
  const {queryParams} = useQueryParamsContext();
  return queryParams;
}

function useSetQueryParams() {
  const {setQueryParams} = useQueryParamsContext();

  return useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setQueryParams(writableQueryParams);
    },
    [setQueryParams]
  );
}

export function useQueryParamsMode(): Mode {
  const queryParams = useQueryParams();
  return queryParams.mode;
}

export function useSetQueryParamsMode() {
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (mode: Mode) => {
      setQueryParams({mode});
    },
    [setQueryParams]
  );
}

export function useQueryParamsGroupBys(): readonly string[] {
  const queryParams = useQueryParams();
  return queryParams.groupBys;
}

export function useQueryParamsTopEventsLimit(): number | undefined {
  const groupBys = useQueryParamsGroupBys();
  return groupBys.every(groupBy => groupBy === '') ? undefined : TOP_EVENTS_LIMIT;
}
