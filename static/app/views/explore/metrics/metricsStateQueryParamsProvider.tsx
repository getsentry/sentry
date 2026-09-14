import type {ReactNode} from 'react';

import {ExploreStateQueryParamsProvider} from 'sentry/views/explore/exploreStateQueryParamsProvider';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';

interface MetricsStateQueryParamsProviderProps {
  children: ReactNode;
}

export function MetricsStateQueryParamsProvider({
  children,
}: MetricsStateQueryParamsProviderProps) {
  return (
    <ExploreStateQueryParamsProvider
      defaultFields={defaultFields}
      defaultSortBys={defaultSortBys}
      defaultAggregateFields={defaultAggregateFields}
      defaultAggregateSortBys={defaultAggregateSortBys}
    >
      {children}
    </ExploreStateQueryParamsProvider>
  );
}
