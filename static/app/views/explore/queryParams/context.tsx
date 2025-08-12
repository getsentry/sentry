import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import type {Sort} from 'sentry/utils/discover/fields';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import type {WritableAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualize,
  type BaseVisualize,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface QueryParamsContextValue {
  queryParams: ReadableQueryParams;
  setQueryParams: (queryParams: WritableQueryParams) => void;
}

const [_QueryParamsContextProvider, useQueryParamsContext, QueryParamsContext] =
  createDefinedContext<QueryParamsContextValue>({
    name: 'QueryParamsContext',
  });

interface QueryParamsContextProps extends QueryParamsContextValue {
  children: ReactNode;
}

export function QueryParamsContextProvider({
  children,
  queryParams,
  setQueryParams,
}: QueryParamsContextProps) {
  const value = useMemo(() => {
    return {
      queryParams,
      setQueryParams,
    };
  }, [queryParams, setQueryParams]);
  return <QueryParamsContext value={value}>{children}</QueryParamsContext>;
}

function useQueryParams() {
  const {queryParams} = useQueryParamsContext();
  return queryParams;
}

function useSetQueryParams() {
  const {setQueryParams} = useQueryParamsContext();

  return useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setQueryParams(writableQueryParams);
    },
    [setQueryParams]
  );
}

export function useQueryParamsMode(): Mode {
  const queryParams = useQueryParams();
  return queryParams.mode;
}

export function useSetQueryParamsMode() {
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (mode: Mode) => {
      setQueryParams({mode});
    },
    [setQueryParams]
  );
}

export function useQueryParamsVisualizes(): readonly Visualize[] {
  const queryParams = useQueryParams();
  return queryParams.visualizes;
}

export function useSetQueryParamsVisualizes() {
  const queryParams = useQueryParams();
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (visualizes: BaseVisualize[]) => {
      const aggregateFields: WritableAggregateField[] = [];

      let i = 0;

      for (const aggregateField of queryParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          aggregateFields.push(visualizes[i++]!);
        } else if (isGroupBy(aggregateField)) {
          aggregateFields.push(aggregateField);
        } else {
          throw new Error('Unknown aggregate field', aggregateField);
        }
      }

      for (; i < visualizes.length; i++) {
        aggregateFields.push(visualizes[i]!);
      }

      setQueryParams({aggregateFields});
    },
    [queryParams, setQueryParams]
  );
}

export function useQueryParamsGroupBys(): readonly string[] {
  const queryParams = useQueryParams();
  return queryParams.groupBys;
}

export function useSetQueryParamsGroupBys() {
  const queryParams = useQueryParams();
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (groupBys: string[]) => {
      const aggregateFields: WritableAggregateField[] = [];

      let i = 0;

      for (const aggregateField of queryParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          aggregateFields.push({
            yAxes: [aggregateField.yAxis],
            chartType: aggregateField.chartType,
          });
        } else if (isGroupBy(aggregateField)) {
          aggregateFields.push({groupBy: groupBys[i++]!});
        } else {
          throw new Error('Unknown aggregate field', aggregateField);
        }
      }

      for (; i < groupBys.length; i++) {
        aggregateFields.push({groupBy: groupBys[i]!});
      }

      setQueryParams({aggregateFields});
    },
    [queryParams, setQueryParams]
  );
}

export function useQueryParamsTopEventsLimit(): number | undefined {
  const groupBys = useQueryParamsGroupBys();
  return groupBys.every(groupBy => groupBy === '') ? undefined : TOP_EVENTS_LIMIT;
}

export function useQueryParamsAggregateSortBys(): readonly Sort[] {
  const queryParams = useQueryParams();
  return queryParams.aggregateSortBys;
}
