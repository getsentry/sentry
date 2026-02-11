import type {ReactNode} from 'react';

import {ExploreStateQueryParamsProvider} from 'sentry/views/explore/exploreStateQueryParamsProvider';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';

interface MetricsStateQueryParamsProviderProps {
  children: ReactNode;
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function MetricsStateQueryParamsProvider({
  children,
  frozenParams,
}: MetricsStateQueryParamsProviderProps) {
  return (
    <ExploreStateQueryParamsProvider
      defaultFields={defaultFields}
      defaultSortBys={defaultSortBys}
      defaultAggregateFields={defaultAggregateFields}
      defaultAggregateSortBys={defaultAggregateSortBys}
      frozenParams={frozenParams}
    >
      {children}
    </ExploreStateQueryParamsProvider>
  );
}
