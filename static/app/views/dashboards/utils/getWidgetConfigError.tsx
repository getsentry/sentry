import {t} from 'sentry/locale';
import {explodeField} from 'sentry/utils/discover/fields';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

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

  // Heat maps plot the metric from their selected "Visualize" aggregate. If that
  // aggregate doesn't resolve to a metric, the widget can't render anything.
  if (widget.displayType === DisplayType.HEATMAP) {
    const query = widget.queries[0];
    const selectedIndex = getSelectedAggregateIndex(
      query?.selectedAggregate,
      query?.aggregates.length ?? 0
    );
    const aggregate = query?.aggregates?.[selectedIndex];
    const traceMetric = aggregate
      ? extractTraceMetricFromColumn(explodeField({field: aggregate}))
      : undefined;
    if (!traceMetric) {
      return t('This widget is missing a metric to visualize.');
    }
  }

  return undefined;
}
