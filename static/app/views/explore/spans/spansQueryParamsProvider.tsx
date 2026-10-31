import {useCallback, type ReactNode} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreQueryParamsProvider} from 'sentry/views/explore/exploreQueryParamsProvider';
import {hasMultiAggregateCharts} from 'sentry/views/explore/spans/sharedChartAggregates';
import {
  getReadableSpansQueryParams,
  getSpansQueryParamsUpdates,
  isDefaultSpansFields,
  SPANS_QUERY_PARSERS,
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
  const getReadableQueryParams = useCallback(
    (values: Parameters<typeof getReadableSpansQueryParams>[0]) =>
      getReadableSpansQueryParams(values, fields, {multiAggregateCharts}),
    [fields, multiAggregateCharts]
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
