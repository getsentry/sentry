import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {useResettableState} from 'sentry/utils/useResettableState';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  QueryParamsContextProvider,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface MetricsQueryParamsProviderProps {
  children: ReactNode;
}

export function MetricsQueryParamsProvider({children}: MetricsQueryParamsProviderProps) {
  const [query, setQuery] = useResettableState(() => '');

  const readableQueryParams = useMemo(() => {
    return new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query,

      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],

      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('sum(value)')],
      aggregateSortBys: [{field: 'sum(value)', kind: 'desc'}],
    });
  }, [query]);

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setQuery(writableQueryParams.query);
    },
    [setQuery]
  );

  return (
    <QueryParamsContextProvider
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}

export function useMetricVisualize() {
  const visualizes = useQueryParamsVisualizes();
  if (visualizes.length === 1) {
    return visualizes[0]!;
  }
  throw new Error('Only 1 visualize per metric allowed');
}
