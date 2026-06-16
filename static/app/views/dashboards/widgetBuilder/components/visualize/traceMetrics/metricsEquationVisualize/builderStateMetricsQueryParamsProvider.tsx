import {useCallback} from 'react';

import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {dispatchYAxisUpdate} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {
  DEFAULT_YAXIS_BY_TYPE,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import type {MetricQuery, TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

interface BuilderStateMetricsQueryParamsProviderProps {
  children: React.ReactNode;
  isSelected: boolean;
  metricQuery: MetricQuery;
  onRemove?: () => void;
  onSubcomponentChanged?: (
    changedLabel: string,
    updatedQueryParams: ReadableQueryParams
  ) => void;
}

/**
 * Wraps MetricsQueryParamsProvider to dispatch widget builder state updates
 * as state changes are being made to the individual metric query.
 */
export function BuilderStateMetricsQueryParamsProvider({
  metricQuery,
  isSelected,
  onRemove,
  onSubcomponentChanged,
  children,
}: BuilderStateMetricsQueryParamsProviderProps) {
  const {state, dispatch} = useWidgetBuilderContext();

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const currentAggregate = aggregateSource?.[0]
    ? generateFieldAsString(aggregateSource[0])
    : '';

  const handleSetQueryParams = useCallback(
    (newQueryParams: ReadableQueryParams) => {
      metricQuery.setQueryParams(newQueryParams);
      if (isSelected) {
        dispatch({
          type: BuilderStateAction.SET_QUERY,
          payload: [newQueryParams.query],
        });
        const yAxis = newQueryParams.visualizes[0]?.yAxis;
        if (yAxis) {
          dispatchYAxisUpdate(
            yAxis,
            currentAggregate,
            state.displayType,
            state.fields,
            dispatch
          );
        }
      } else {
        onSubcomponentChanged?.(metricQuery.label ?? '', newQueryParams);
      }
    },
    [
      metricQuery,
      isSelected,
      currentAggregate,
      state.displayType,
      state.fields,
      dispatch,
      onSubcomponentChanged,
    ]
  );

  const handleSetTraceMetric = useCallback(
    (newTraceMetric: TraceMetric) => {
      metricQuery.setTraceMetric(newTraceMetric);
      const visualize = metricQuery.queryParams.visualizes[0];
      if (visualize && isVisualizeFunction(visualize)) {
        const selectedAgg = visualize.parsedFunction?.name;
        const allowed = OPTIONS_BY_TYPE[newTraceMetric.type];
        const agg =
          selectedAgg && allowed?.find(o => o.value === selectedAgg)
            ? selectedAgg
            : DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] || 'sum';
        const newVisualize = updateVisualizeYAxis(visualize, agg, newTraceMetric);
        if (isSelected) {
          dispatchYAxisUpdate(
            newVisualize.yAxis,
            currentAggregate,
            state.displayType,
            state.fields,
            dispatch
          );
        } else {
          const updatedQueryParams = metricQuery.queryParams.replace({
            aggregateFields: [
              newVisualize,
              ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
            ],
          });
          onSubcomponentChanged?.(metricQuery.label ?? '', updatedQueryParams);
        }
      }
    },
    [
      metricQuery,
      isSelected,
      currentAggregate,
      state.displayType,
      state.fields,
      dispatch,
      onSubcomponentChanged,
    ]
  );

  const handleRemoveMetric = useCallback(() => {
    metricQuery.removeMetric();
    onRemove?.();
  }, [metricQuery, onRemove]);

  return (
    <MetricsQueryParamsProvider
      queryParams={metricQuery.queryParams}
      traceMetric={metricQuery.metric}
      setTraceMetric={handleSetTraceMetric}
      setQueryParams={handleSetQueryParams}
      removeMetric={handleRemoveMetric}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}
