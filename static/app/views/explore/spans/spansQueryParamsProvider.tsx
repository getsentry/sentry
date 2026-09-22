import type {ReactNode} from 'react';

import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function SpansQueryParamsProvider({
  children,
  frozenParams,
}: SpansQueryParamsProviderProps) {
  return (
    <ExploreLocationQueryParamsProvider
      frozenParams={frozenParams}
      getReadableQueryParamsFromLocation={getReadableQueryParamsFromLocation}
      getTargetWithReadableQueryParams={getTargetWithReadableQueryParams}
      isDefaultFields={isDefaultFields}
    >
      {children}
    </ExploreLocationQueryParamsProvider>
  );
}
