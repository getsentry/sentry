import {t} from 'sentry/locale';
import {explodeField, isEquation} from 'sentry/utils/discover/fields';
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

  // Trace-metric widgets encode the metric in the aggregate (fn(value, name, type,
  // unit)); if any non-equation aggregate doesn't resolve to a metric, nothing can
  // render. Applies to every display type, including heat maps. Equations carry no
  // metric tuple and reference base aggregates that are validated on their own.
  const hasUnresolvedMetric =
    widget.widgetType === WidgetType.TRACEMETRICS &&
    widget.queries
      .flatMap(query => query.aggregates)
      .filter(aggregate => !isEquation(aggregate))
      .some(aggregate => !extractTraceMetricFromColumn(explodeField({field: aggregate})));
  if (hasUnresolvedMetric) {
    return t('This widget is missing a metric to visualize.');
  }

  if (widget.displayType === DisplayType.HEATMAP) {
    if (widget.widgetType !== WidgetType.TRACEMETRICS) {
      return t('This dataset does not support this visualization.');
    }
    const aggregate = getSelectedAggregate(widget);
    const traceMetric = aggregate && extractTraceMetricFromColumn(aggregate);
    if (traceMetric && !doesMetricSupportHeatMapVisualization(traceMetric)) {
      return t('Heatmaps can only visualize distribution metrics.');
    }
  }

  return undefined;
}
