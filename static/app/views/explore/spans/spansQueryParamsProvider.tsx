import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useQueryStates} from 'nuqs';

import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {
  getReadableQueryParamsFromParsed,
  getSpansQueryParamsUpdate,
  spansQueryParamsParsers,
  SPANS_FIELD_KEY,
} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const [queryParams, setNuqsParams] = useQueryStates(spansQueryParamsParsers, {
    history: 'push',
  });
  const [optimisticQueryParams, setOptimisticQueryParams] =
    useState<typeof queryParams>();

  useEffect(() => {
    setOptimisticQueryParams(undefined);
  }, [queryParams]);

  const activeQueryParams = optimisticQueryParams ?? queryParams;

  // nuqs creates new object references for all params on every URL change,
  // even for values that didn't change. Use value-based comparison via
  // JSON.stringify so downstream memos/effects have stable references.
  const queryParamsKey = JSON.stringify(activeQueryParams);
  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromParsed(activeQueryParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryParamsKey intentionally replaces queryParams for value-based comparison
    [queryParamsKey]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const update = getSpansQueryParamsUpdate(writableQueryParams);
      setOptimisticQueryParams(prev => ({...(prev ?? queryParams), ...update}));
      setNuqsParams(update);
    },
    [queryParams, setNuqsParams]
  );

  const isUsingDefaultFields = !activeQueryParams[SPANS_FIELD_KEY];

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
