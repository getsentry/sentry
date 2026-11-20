import {useCallback, type ReactNode} from 'react';

import {ExploreQueryParamsProvider} from 'sentry/views/explore/exploreQueryParamsProvider';

import {
  getReadableSpansQueryParams,
  getSpansQueryParamsUpdates,
  isDefaultSpansFields,
  SPANS_QUERY_PARSERS,
} from './spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
  fields?: string[];
}

export function SpansQueryParamsProvider({
  children,
  fields,
}: SpansQueryParamsProviderProps) {
  const getReadableQueryParams = useCallback(
    (values: Parameters<typeof getReadableSpansQueryParams>[0]) =>
      getReadableSpansQueryParams(values, fields),
    [fields]
  );

  return (
    <ExploreQueryParamsProvider
      getQueryParamsUpdates={getSpansQueryParamsUpdates}
      getReadableQueryParams={getReadableQueryParams}
      isDefaultFields={isDefaultSpansFields}
      parsers={SPANS_QUERY_PARSERS}
    >
      {children}
    </ExploreQueryParamsProvider>
  );
}
