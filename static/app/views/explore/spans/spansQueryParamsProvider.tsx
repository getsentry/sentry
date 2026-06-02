import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
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

  // nuqs creates new object references for all params on every URL change,
  // even for values that didn't change. Use value-based comparison via
  // JSON.stringify so downstream memos/effects have stable references.
  const queryParamsKey = JSON.stringify(queryParams);
  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromParsed(queryParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryParamsKey intentionally replaces queryParams for value-based comparison
    [queryParamsKey]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setNuqsParams(getSpansQueryParamsUpdate(writableQueryParams));
    },
    [setNuqsParams]
  );

  const isUsingDefaultFields = !queryParams[SPANS_FIELD_KEY];

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
