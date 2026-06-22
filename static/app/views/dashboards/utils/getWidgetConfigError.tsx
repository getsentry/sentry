import {t} from 'sentry/locale';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
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
  // unsupported combination can't render. Only display types that are actually
  // dataset-driven are validated here — special widgets (Text/Markdown, Wheel,
  // Rage & Dead Clicks, Agents traces, etc.) aren't backed by a dataset, so
  // they're not "supported" by any of them and must be exempt.
  if (
    isDatasetDrivenDisplayType(widget.displayType) &&
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

function isDatasetDrivenDisplayType(displayType: DisplayType): boolean {
  return DATASET_DRIVEN_DISPLAY_TYPES.has(displayType);
}

// The set of display types that at least one dataset supports. A display type
// outside this set is a special widget (e.g. Text/Markdown) that doesn't belong
// to any dataset and therefore can't be flagged as unsupported by one.
const DATASET_DRIVEN_DISPLAY_TYPES = new Set(
  Object.values(WidgetType).flatMap(
    widgetType => getDatasetConfig(widgetType).supportedDisplayTypes
  )
);
