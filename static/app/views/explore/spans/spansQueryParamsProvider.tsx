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

  const readableQueryParams = useMemo(
    () => getReadableQueryParamsFromParsed(queryParams),
    [queryParams]
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
