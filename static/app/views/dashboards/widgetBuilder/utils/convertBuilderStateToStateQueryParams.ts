import {WidgetType} from 'sentry/views/dashboards/types';
import {
  serializeFields,
  serializeSorts,
  serializeThresholds,
  serializeTraceMetric,
  type WidgetBuilderState,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function convertBuilderStateToStateQueryParams(
  state: WidgetBuilderState
): WidgetBuilderStateQueryParams {
  const {fields, yAxis, sort, thresholds, traceMetric, ...rest} = state;
  return {
    ...rest,
    field: serializeFields(fields ?? []),
    yAxis: serializeFields(yAxis ?? []),
    sort: serializeSorts(WidgetType.SPANS)(sort ?? []),
    thresholds: thresholds ? serializeThresholds(thresholds) : undefined,
    traceMetric:
      traceMetric?.name && traceMetric?.type
        ? serializeTraceMetric(traceMetric)
        : undefined,
  };
}
