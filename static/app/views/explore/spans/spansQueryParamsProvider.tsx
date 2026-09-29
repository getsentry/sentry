import {useCallback, type ReactNode} from 'react';
import type {Location} from 'history';

import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/spans/spansQueryParams';

interface SpansQueryParamsProviderProps {
  children: ReactNode;
  fields?: string[];
}

export function SpansQueryParamsProvider({
  children,
  fields,
}: SpansQueryParamsProviderProps) {
  const getQueryParams = useCallback(
    (location: Location) => getReadableQueryParamsFromLocation(location, fields),
    [fields]
  );

  return (
    <ExploreLocationQueryParamsProvider
      getReadableQueryParamsFromLocation={getQueryParams}
      getTargetWithReadableQueryParams={getTargetWithReadableQueryParams}
      isDefaultFields={isDefaultFields}
    >
      {children}
    </ExploreLocationQueryParamsProvider>
  );
}
