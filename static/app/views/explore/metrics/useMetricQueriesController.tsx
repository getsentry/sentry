import {useMemo, type Dispatch, type SetStateAction} from 'react';

import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_YAXIS_BY_TYPE,
  doesMetricSupportHeatMapVisualization,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import {syncEquationMetricQueries} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {getMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  getNextLabel,
  moveItem,
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
import {
  isVisualizeEquation,
  isVisualizeFunction,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

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

function withTraceMetric(
  metricQuery: BaseMetricQuery,
  newTraceMetric: TraceMetric
): BaseMetricQuery {
  // When changing trace metrics, adjust the currently selected
  // aggregation so it's valid for the new metric's type.
  const visualize = metricQuery.queryParams.visualizes[0];
  let aggregateFields: Array<GroupBy | VisualizeFunction> | undefined;
  if (visualize && isVisualizeFunction(visualize)) {
    const selectedAggregation = visualize.parsedFunction?.name;
    const allowedAggregations = OPTIONS_BY_TYPE[newTraceMetric.type];
    const aggregation =
      selectedAggregation &&
      allowedAggregations?.find(option => option.value === selectedAggregation)
        ? selectedAggregation
        : DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] || 'sum';

    let updatedVisualize = updateVisualizeYAxis(visualize, aggregation, newTraceMetric);

    if (
      visualize.chartType === ChartType.HEATMAP &&
      !doesMetricSupportHeatMapVisualization(newTraceMetric)
    ) {
      updatedVisualize = updatedVisualize.replace({
        chartType: determineDefaultChartType([updatedVisualize.yAxis]),
      });
    }

    aggregateFields = [
      updatedVisualize,
      ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
    ];
  }

  return {
    queryParams: metricQuery.queryParams.replace({aggregateFields}),
    metric: newTraceMetric,
    label: metricQuery.label,
  };
}

export interface MetricQueriesControllerValue {
  addMetricQuery: (options?: {type?: 'aggregate' | 'equation'}) => string;
  metricQueries: MetricQuery[];
  reorderMetricQueries: (oldIndex: number, newIndex: number) => void;
}

type RowMutators = Pick<
  MetricQuery,
  'setQueryParams' | 'setTraceMetric' | 'removeMetric'
>;

interface UseMetricQueriesControllerArgs {
  queries: BaseMetricQuery[];
  setQueries: Dispatch<SetStateAction<BaseMetricQuery[]>>;
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
}: UseMetricQueriesControllerArgs): MetricQueriesControllerValue {
  const labels = useStableLabels(queries);

  const getRowMutators = useMemo(() => {
    function updateQuery(
      rowId: string,
      update: (metricQuery: BaseMetricQuery) => BaseMetricQuery
    ) {
      // Read rows at call time: a deferred useState updater sees only the calls
      // made before this one, and so does this snapshot.
      const rowIds = labels.getRowIds();
      const rowLabels = rowIds.map((_, j) => labels.getLabel(j));
      const index = rowIds.indexOf(rowId);
      setQueries(previousQueries => {
        if (index === -1 || previousQueries.length !== rowIds.length) {
          return previousQueries;
        }
        const labeledQueries = previousQueries.map((metricQuery, j) => ({
          ...metricQuery,
          label: rowLabels[j],
        }));
        const newMetricQueries = labeledQueries.map((metricQuery, j) =>
          j === index ? update(metricQuery) : metricQuery
        );
        return syncUpdatedMetricQueries(labeledQueries, newMetricQueries);
      });
    }

    function createRowMutators(rowId: string): RowMutators {
      return {
        setQueryParams: newQueryParams =>
          updateQuery(rowId, metricQuery => ({
            metric: metricQuery.metric,
            queryParams: newQueryParams,
            label: metricQuery.label,
          })),
        setTraceMetric: newTraceMetric =>
          updateQuery(rowId, metricQuery => withTraceMetric(metricQuery, newTraceMetric)),
        removeMetric: () => {
          const rowIds = labels.getRowIds();
          const index = rowIds.indexOf(rowId);
          if (index === -1 || rowIds.length <= 1) {
            return;
          }
          // Update the label ref synchronously before the storage write so
          // labels stay stable on the next render.
          labels.remove(index);
          setQueries(previousQueries => previousQueries.toSpliced(index, 1));
        },
      };
    }

    const mutatorsByRowId = new Map<string, RowMutators>();

    return (rowId: string) => {
      let mutators = mutatorsByRowId.get(rowId);
      if (!mutators) {
        mutators = createRowMutators(rowId);
        // oxlint-disable-next-line react/immutability
        mutatorsByRowId.set(rowId, mutators);
      }
      return mutators;
    };
  }, [setQueries, labels]);

  const rowIdsKey = labels.getRowIds().join(',');
  const rowMutators = useMemo(
    () => rowIdsKey.split(',').map(getRowMutators),
    [rowIdsKey, getRowMutators]
  );

  return useMemo(() => {
    const labeledQueries: BaseMetricQuery[] = queries.map((query, i) => ({
      ...query,
      label: labels.getLabel(i),
    }));

    function addMetricQuery({
      type = 'aggregate',
    }: {type?: 'aggregate' | 'equation'} = {}) {
      const nextLabel = getNextLabel(labeledQueries, type);

      const equationStart = labeledQueries.findIndex(metricQuery =>
        isVisualizeEquation(metricQuery.queryParams.visualizes[0]!)
      );
      const insertAt =
        equationStart !== -1 && type === 'aggregate'
          ? equationStart
          : labeledQueries.length;
      labels.insert(insertAt, nextLabel);
      setQueries(previousQueries => {
        const lastAggregate = previousQueries.at(insertAt - 1) ?? defaultMetricQuery();
        const canDuplicate =
          type === 'aggregate' &&
          lastAggregate.queryParams.visualizes.some(isVisualizeFunction);
        const newQuery = canDuplicate
          ? {...lastAggregate, label: nextLabel}
          : defaultMetricQuery({type});
        return previousQueries.toSpliced(insertAt, 0, newQuery);
      });
      return nextLabel;
    }

    function reorderMetricQueries(oldIndex: number, newIndex: number) {
      labels.move(oldIndex, newIndex);
      setQueries(previousQueries => moveItem(previousQueries, oldIndex, newIndex));
    }

    return {
      metricQueries: labeledQueries.map((metricQuery, i) => ({
        ...metricQuery,
        ...rowMutators[i]!,
      })),
      addMetricQuery,
      reorderMetricQueries,
    };
  }, [queries, setQueries, labels, rowMutators]);
}
