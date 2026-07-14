import type {ReactNode} from 'react';

import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  return (
    <ExploreLocationQueryParamsProvider
      getReadableQueryParamsFromLocation={getReadableQueryParamsFromLocation}
      getTargetWithReadableQueryParams={getTargetWithReadableQueryParams}
      isDefaultFields={isDefaultFields}
    >
      {children}
    </ExploreLocationQueryParamsProvider>
  );
}
