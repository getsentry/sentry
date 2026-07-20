import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregate} from 'sentry/views/dashboards/widgetBuilder/utils/getSelectedAggregate';
import {doesMetricSupportHeatMapVisualization} from 'sentry/views/explore/metrics/constants';

/**
 * Returns a user-facing error message if the widget has a static config
 * problem that would prevent it from displaying data. Returns undefined
 * if the widget config is valid.
 */
export function getWidgetConfigError(widget: Widget): string | undefined {
  if (
    usesTimeSeriesData(widget.displayType) &&
    widget.queries.every(q => q.aggregates.length === 0)
  ) {
    return t('The widget configuration is not valid. Please add a "Visualize" field.');
  }

  // Heat maps are only offered on the trace-metrics dataset, and plot the metric
  // from their selected "Visualize" aggregate. If they're on another dataset or
  // that aggregate doesn't resolve to a metric, the widget can't render.
  if (widget.displayType === DisplayType.HEATMAP) {
    if (widget.widgetType !== WidgetType.TRACEMETRICS) {
      return t('This dataset does not support this visualization.');
    }
    const aggregate = getSelectedAggregate(widget);
    const traceMetric = aggregate && extractTraceMetricFromColumn(aggregate);
    if (!traceMetric) {
      return t('This widget is missing a metric to visualize.');
    }
    if (!doesMetricSupportHeatMapVisualization(traceMetric)) {
      return t('Heatmaps can only visualize distribution metrics.');
    }
  }

  return undefined;
}
