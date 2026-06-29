import type {ReactNode} from 'react';

import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {defaultSortBys} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {ExploreStateQueryParamsProvider} from 'sentry/views/explore/exploreStateQueryParamsProvider';
import {
  defaultAggregateSortBys,
  defaultVisualizes,
} from 'sentry/views/explore/logs/logsQueryParams';
import {defaultGroupBys} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';

interface LogsStateQueryParamsProviderProps {
  children: ReactNode;
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function LogsStateQueryParamsProvider({
  children,
  frozenParams,
}: LogsStateQueryParamsProviderProps) {
  return (
    <ExploreStateQueryParamsProvider
      defaultFields={defaultLogFields}
      defaultSortBys={defaultSortBys}
      defaultAggregateFields={defaultAggregateFields}
      defaultAggregateSortBys={defaultAggregateSortBys}
      frozenParams={frozenParams}
    >
      {children}
    </ExploreStateQueryParamsProvider>
  );
}

function defaultAggregateFields() {
  return [...defaultGroupBys(), ...defaultVisualizes()];
}
