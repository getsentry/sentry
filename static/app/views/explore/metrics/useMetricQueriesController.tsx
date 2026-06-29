import {useMemo} from 'react';

import {
  DEFAULT_YAXIS_BY_TYPE,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import {syncEquationMetricQueries} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {getMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  getNextLabel,
  useStableLabels,
} from 'sentry/views/explore/metrics/hooks/useStableLabels';
import {
  defaultMetricQuery,
  type BaseMetricQuery,
  type MetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeEquation,
  isVisualizeFunction,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

function syncUpdatedMetricQueries(
  previousMetricQueries: BaseMetricQuery[],
  nextMetricQueries: BaseMetricQuery[]
): BaseMetricQuery[] {
  return syncEquationMetricQueries(
    nextMetricQueries,
    getMetricReferences(previousMetricQueries),
    getMetricReferences(nextMetricQueries)
  );
}

export interface MetricQueriesControllerValue {
  addMetricQuery: (options?: {type?: 'aggregate' | 'equation'}) => void;
  metricQueries: MetricQuery[];
  reorderMetricQueries: (
    reorderedQueries: BaseMetricQuery[],
    oldIndex: number,
    newIndex: number
  ) => void;
}

interface UseMetricQueriesControllerArgs {
  queries: BaseMetricQuery[];
  setQueries: (nextQueries: BaseMetricQuery[]) => void;
  /**
   * Whether equations are enabled. Gates the insert-before-equation behavior
   * of `addMetricQuery` so new aggregates are inserted before any existing
   * equation rather than appended after them.
   */
  hasEquations?: boolean;
}

/**
 * Storage-agnostic controller for a list of metric queries.
 *
 * Consumers (URL-backed provider, local-state form, etc.) supply `queries` and
 * `setQueries`; the hook returns the `MetricQuery[]` with bound per-row
 * mutators along with collection-level mutators (add, reorder). Stable labels
 * are managed internally across mutations.
 */
export function useMetricQueriesController({
  queries,
  setQueries,
  hasEquations,
}: UseMetricQueriesControllerArgs): MetricQueriesControllerValue {
  const labels = useStableLabels(queries);

  return useMemo(() => {
    const labeledQueries: BaseMetricQuery[] = queries.map((query, i) => ({
      ...query,
      label: labels.getLabel(i),
      setQueryParams: () => {},
      setTraceMetric: () => {},
      removeMetric: () => {},
    }));

    function setQueryParamsForIndex(i: number) {
      return function (newQueryParams: ReadableQueryParams) {
        const newMetricQueries = labeledQueries.map(
          (metricQuery: BaseMetricQuery, j: number) => {
            if (i !== j) {
              return metricQuery;
            }
            return {
              metric: metricQuery.metric,
              queryParams: newQueryParams,
              label: metricQuery.label,
            };
          }
        );
        setQueries(syncUpdatedMetricQueries(labeledQueries, newMetricQueries));
      };
    }

    function setTraceMetricForIndex(i: number) {
      return function (newTraceMetric: TraceMetric) {
        const newMetricQueries = labeledQueries.map(
          (metricQuery: BaseMetricQuery, j: number) => {
            if (i !== j) {
              return metricQuery;
            }

            // When changing trace metrics, adjust the currently selected
            // aggregation so it's valid for the new metric's type.
            const visualize = metricQuery.queryParams.visualizes[0];
            let aggregateFields: Array<GroupBy | VisualizeFunction> | undefined;
            if (visualize && isVisualizeFunction(visualize)) {
              const selectedAggregation = visualize.parsedFunction?.name;
              const allowedAggregations = OPTIONS_BY_TYPE[newTraceMetric.type];

              if (
                selectedAggregation &&
                allowedAggregations?.find(option => option.value === selectedAggregation)
              ) {
                aggregateFields = [
                  updateVisualizeYAxis(visualize, selectedAggregation, newTraceMetric),
                  ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
                ];
              } else {
                const defaultAggregation =
                  DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] || 'sum';
                aggregateFields = [
                  updateVisualizeYAxis(visualize, defaultAggregation, newTraceMetric),
                  ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
                ];
              }
            }

            return {
              queryParams: metricQuery.queryParams.replace({aggregateFields}),
              metric: newTraceMetric,
              label: metricQuery.label,
            };
          }
        );
        setQueries(syncUpdatedMetricQueries(labeledQueries, newMetricQueries));
      };
    }

    function removeMetricQueryForIndex(i: number) {
      return function () {
        if (labeledQueries.length <= 1) {
          return;
        }
        // Update the label ref synchronously before the storage write so
        // labels stay stable on the next render.
        labels.remove(i);
        setQueries(labeledQueries.filter((_, j) => i !== j));
      };
    }

    function addMetricQuery({
      type = 'aggregate',
    }: {type?: 'aggregate' | 'equation'} = {}) {
      const nextLabel = getNextLabel(labeledQueries, type);

      const equationStart = labeledQueries.findIndex(metricQuery =>
        isVisualizeEquation(metricQuery.queryParams.visualizes[0]!)
      );
      const insertAt =
        hasEquations && equationStart !== -1 && type === 'aggregate'
          ? equationStart
          : labeledQueries.length;
      const lastAggregate = labeledQueries.at(insertAt - 1) ?? defaultMetricQuery();
      const canDuplicate =
        type === 'aggregate' &&
        lastAggregate?.queryParams.visualizes.some(isVisualizeFunction);
      const newQuery = canDuplicate
        ? {...lastAggregate, label: nextLabel}
        : defaultMetricQuery({type});

      labels.insert(insertAt, nextLabel);
      setQueries(labeledQueries.toSpliced(insertAt, 0, newQuery));
    }

    function reorderMetricQueries(
      reorderedQueries: BaseMetricQuery[],
      oldIndex: number,
      newIndex: number
    ) {
      labels.move(oldIndex, newIndex);
      setQueries(reorderedQueries);
    }

    return {
      metricQueries: labeledQueries.map((metric, index) => ({
        ...metric,
        setQueryParams: setQueryParamsForIndex(index),
        setTraceMetric: setTraceMetricForIndex(index),
        removeMetric: removeMetricQueryForIndex(index),
      })),
      addMetricQuery,
      reorderMetricQueries,
    };
  }, [queries, setQueries, labels, hasEquations]);
}
