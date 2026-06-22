import {t} from 'sentry/locale';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregate} from 'sentry/views/dashboards/widgetBuilder/utils/getSelectedAggregate';

/**
 * Returns a user-facing error message if the widget has a static config
 * problem that would prevent it from displaying data. Returns undefined
 * if the widget config is valid.
 */
export function getWidgetConfigError(widget: Widget): string | undefined {
  // Each dataset declares the display types it supports; a widget using an
  // unsupported combination can't render.
  if (
    !getDatasetConfig(widget.widgetType).supportedDisplayTypes.includes(
      widget.displayType
    )
  ) {
    return t('This dataset does not support this visualization.');
  }

  if (
    usesTimeSeriesData(widget.displayType) &&
    widget.queries.every(q => q.aggregates.length === 0)
  ) {
    return t('The widget configuration is not valid. Please add a "Visualize" field.');
  }

  // Heat maps plot the metric from their selected "Visualize" aggregate. If
  // that aggregate doesn't resolve to a metric, the widget can't render.
  if (widget.displayType === DisplayType.HEATMAP) {
    const aggregate = getSelectedAggregate(widget);
    if (!aggregate || !extractTraceMetricFromColumn(aggregate)) {
      return t('This widget is missing a metric to visualize.');
    }
  }

  return undefined;
}
