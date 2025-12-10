import {WidgetType} from 'sentry/views/dashboards/types';
import {
  serializeFields,
  serializeSorts,
  serializeThresholds,
  serializeTraceMetrics,
  type WidgetBuilderState,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function convertBuilderStateToStateQueryParams(
  state: WidgetBuilderState
): WidgetBuilderStateQueryParams {
  const {fields, yAxis, sort, thresholds, traceMetrics, ...rest} = state;
  return {
    ...rest,
    field: serializeFields(fields ?? []),
    yAxis: serializeFields(yAxis ?? []),
    sort: serializeSorts(WidgetType.SPANS)(sort ?? []),
    thresholds: thresholds ? serializeThresholds(thresholds) : undefined,
    traceMetrics:
      traceMetrics && traceMetrics.length > 0
        ? serializeTraceMetrics(traceMetrics)
        : undefined,
  };
}
