import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {deriveUpdatedManagedFields} from 'sentry/views/explore/queryParams/managedFields';
import type {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualize,
  isVisualizeEquation,
  type BaseVisualize,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface QueryParamsContextValue {
  managedFields: Set<string>;
  queryParams: ReadableQueryParams;
  setManagedFields: (managedFields: Set<string>) => void;
  setQueryParams: (queryParams: WritableQueryParams) => void;
}

const [_QueryParamsContextProvider, useQueryParamsContext, QueryParamsContext] =
  createDefinedContext<QueryParamsContextValue>({
    name: 'QueryParamsContext',
  });

interface QueryParamsContextProps {
  children: ReactNode;
  isUsingDefaultFields: boolean;
  queryParams: ReadableQueryParams;
  setQueryParams: (queryParams: WritableQueryParams) => void;
  shouldManageFields: boolean;
}

function setManagedFieldsStub() {}

export function QueryParamsContextProvider({
  children,
  isUsingDefaultFields,
  queryParams,
  setQueryParams,
  shouldManageFields,
}: QueryParamsContextProps) {
  const [managedFields, setManagedFields] = useState(new Set<string>());

  // Whenever the fields is reset to the defaults, we should wipe the state of the
  // managed fields. This can happen when
  // 1. user clicks on the side bar when already on the page
  // 2. some code intentionally wipes the fields
  useEffect(() => {
    if (isUsingDefaultFields) {
      setManagedFields(new Set());
    }
  }, [isUsingDefaultFields]);

  const value = useMemo(() => {
    return {
      managedFields,
      setManagedFields: shouldManageFields ? setManagedFields : setManagedFieldsStub,
      queryParams,
      setQueryParams,
    };
  }, [managedFields, setManagedFields, queryParams, setQueryParams, shouldManageFields]);

  return <QueryParamsContext value={value}>{children}</QueryParamsContext>;
}

export function useQueryParams() {
  const {queryParams} = useQueryParamsContext();
  return queryParams;
}

function useSetQueryParams() {
  const {
    managedFields,
    setManagedFields,
    queryParams: readableQueryParams,
    setQueryParams,
  } = useQueryParamsContext();

  return useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const {updatedFields, updatedManagedFields} = deriveUpdatedManagedFields(
        managedFields,
        readableQueryParams,
        writableQueryParams
      );

      if (defined(updatedManagedFields)) {
        setManagedFields(updatedManagedFields);
      }

      if (defined(updatedFields)) {
        writableQueryParams.fields = updatedFields;
      }

      if (shouldResetCursors(writableQueryParams)) {
        // setting it to null tells the implementer that it should be reset
        writableQueryParams.cursor = null;
        writableQueryParams.aggregateCursor = null;
      }
      setQueryParams(writableQueryParams);
    },
    [managedFields, setManagedFields, readableQueryParams, setQueryParams]
  );
}

function shouldResetCursors(queryParams: WritableQueryParams): boolean {
  return (
    defined(queryParams.aggregateFields) ||
    defined(queryParams.aggregateSortBys) ||
    defined(queryParams.fields) ||
    defined(queryParams.query) ||
    defined(queryParams.sortBys)
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

export function useQueryParamsFields(): readonly string[] {
  const queryParams = useQueryParams();
  return queryParams.fields;
}

export function useQueryParamsSortBys(): readonly Sort[] {
  const queryParams = useQueryParams();
  return queryParams.sortBys;
}

interface UseQueryParamsAggregateFieldsOptions {
  validate: boolean;
}

export function useQueryParamsAggregateFields(
  options?: UseQueryParamsAggregateFieldsOptions
): readonly AggregateField[] {
  const {validate = false} = options || {};
  const queryParams = useQueryParams();
  return useMemo(() => {
    if (validate) {
      return queryParams.aggregateFields.filter(aggregateField => {
        if (isVisualize(aggregateField) && isVisualizeEquation(aggregateField)) {
          return aggregateField.expression.isValid;
        }
        return true;
      });
    }
    return queryParams.aggregateFields;
  }, [queryParams.aggregateFields, validate]);
}

export function useSetQueryParamsAggregateFields() {
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (aggregateFields: WritableAggregateField[]) => {
      setQueryParams({aggregateFields});
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

      const iter = visualizes[Symbol.iterator]();

      for (const aggregateField of queryParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          const {value: visualize, done} = iter.next();
          if (!done) {
            aggregateFields.push(visualize);
          }
        } else if (isGroupBy(aggregateField)) {
          aggregateFields.push(aggregateField);
        } else {
          throw new Error(`Unknown aggregate field: ${JSON.stringify(aggregateField)}`);
        }
      }

      for (const visualize of iter) {
        aggregateFields.push(visualize);
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
    (groupBys: string[], mode?: Mode) => {
      let seenVisualizes = false;
      let groupByAfterVisualizes = false;

      for (const aggregateField of queryParams.aggregateFields) {
        if (isGroupBy(aggregateField) && seenVisualizes) {
          groupByAfterVisualizes = true;
          break;
        } else if (isVisualize(aggregateField)) {
          seenVisualizes = true;
        }
      }

      const aggregateFields: WritableAggregateField[] = [];

      const iter = groupBys[Symbol.iterator]();

      for (const aggregateField of queryParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          if (!groupByAfterVisualizes) {
            // no existing group by appears after a visualize, so any additional
            // group bys will be inserted before any visualizes as well
            for (const groupBy of iter) {
              aggregateFields.push({groupBy});
            }
          }
          aggregateFields.push({
            yAxes: [aggregateField.yAxis],
            chartType: aggregateField.selectedChartType,
          });
        } else if (isGroupBy(aggregateField)) {
          const {value: groupBy, done} = iter.next();
          if (!done) {
            aggregateFields.push({groupBy});
          }
        } else {
          throw new Error('Unknown aggregate field', aggregateField);
        }
      }

      for (const groupBy of iter) {
        aggregateFields.push({groupBy});
      }

      setQueryParams({aggregateFields, mode});
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

export function useQueryParamsAggregateCursor(): string {
  const queryParams = useQueryParams();
  return queryParams.aggregateCursor;
}

export function useSetQueryParamsAggregateCursor() {
  const setQueryParams = useSetQueryParams();

  return useCallback(
    (aggregateCursor: string | undefined) => {
      setQueryParams({aggregateCursor});
    },
    [setQueryParams]
  );
}

export function useQueryParamsCursor(): string {
  const queryParams = useQueryParams();
  return queryParams.cursor;
}
