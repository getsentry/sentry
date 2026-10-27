import {useCallback, type ReactNode} from 'react';
import type {Location} from 'history';

import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import {hasMultiAggregateCharts} from 'sentry/views/explore/spans/sharedChartAggregates';
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
  const organization = useOrganization({allowNull: true});
  const multiAggregateCharts = organization
    ? hasMultiAggregateCharts(organization)
    : false;
  const getQueryParams = useCallback(
    (location: Location) =>
      getReadableQueryParamsFromLocation(location, fields, {multiAggregateCharts}),
    [fields, multiAggregateCharts]
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
