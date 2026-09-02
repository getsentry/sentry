import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregate} from 'sentry/views/dashboards/widgetBuilder/utils/getSelectedAggregate';
import {hasUnresolvedTraceMetric} from 'sentry/views/dashboards/widgetBuilder/utils/hasUnresolvedTraceMetric';
import {doesMetricSupportHeatMapVisualization} from 'sentry/views/explore/metrics/constants';

/**
 * Returns a user-facing error message if the widget has a static config
 * problem that would prevent it from displaying data. Returns undefined
 * if the widget config is valid.
 *
 * `hasBlankEquation` is a builder-only signal: `convertBuilderStateToWidget`
 * strips blank equations, so a widget whose only "Visualize" entry is an
 * unfinished equation arrives here with no aggregates and is indistinguishable
 * from an empty one. The builder passes this in to swap the generic
 * missing-field error for a more specific nudge. Saved widgets never carry a
 * blank equation, so callers without builder state can omit it.
 */
export function getWidgetConfigError(
  widget: Widget,
  {hasBlankEquation = false}: {hasBlankEquation?: boolean} = {}
): string | undefined {
  if (
    usesTimeSeriesData(widget.displayType) &&
    widget.queries.every(q => q.aggregates.length === 0)
  ) {
    return hasBlankEquation
      ? t('Enter an equation to preview results')
      : t('The widget configuration is not valid. Please add a "Visualize" field.');
  }

  if (
    widget.widgetType === WidgetType.TRACEMETRICS &&
    widget.displayType === DisplayType.TABLE &&
    widget.queries.every(q => q.aggregates.length === 0)
  ) {
    return t('This widget is missing a metric aggregation to visualize.');
  }

  // Trace-metric widgets encode the metric in the aggregate; if it doesn't resolve,
  // nothing can render (applies to every display type, including heat maps).
  if (widget.widgetType === WidgetType.TRACEMETRICS && hasUnresolvedTraceMetric(widget)) {
    return t('This widget is missing a metric to visualize.');
  }

  if (widget.displayType === DisplayType.HEATMAP) {
    if (widget.widgetType !== WidgetType.TRACEMETRICS) {
      return t('This dataset does not support this visualization.');
    }
    const aggregate = getSelectedAggregate(widget);
    const traceMetric = aggregate && extractTraceMetricFromColumn(aggregate);
    if (!traceMetric) {
      // No aggregate at all — a present-but-unresolved one is already caught above.
      return t('This widget is missing a metric to visualize.');
    }
    if (!doesMetricSupportHeatMapVisualization(traceMetric)) {
      return t('Heatmaps can only visualize distribution metrics.');
    }
  }

  return undefined;
}
