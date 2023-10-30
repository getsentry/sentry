import {Organization} from 'sentry/types';
import {AggregationKey} from 'sentry/utils/fields';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {Widget, WidgetType} from 'sentry/views/dashboards/types';

/**
 * We determine that a widget is an on-demand metric widget if the widget
 * 1. type is discover
 * 2. contains no grouping
 * 3. contains only one query condition
 * 4. contains only one aggregate and does not contain unsupported aggregates
 * 5. contains one of the keys that are not supported by the standard metrics.
 */
export function isOnDemandMetricWidget(widget: Widget): boolean {
  if (widget.widgetType !== WidgetType.DISCOVER) {
    return false;
  }

  // currently we only support widgets without grouping
  const columns = widget.queries.flatMap(query => query.columns);

  if (columns.length > 0) {
    return false;
  }

  const conditions = widget.queries.flatMap(query => query.conditions);

  const hasNonStandardConditions = conditions.some(condition =>
    isOnDemandQueryString(condition)
  );

  // currently we only support one query per widget for on-demand metrics
  if (conditions.length > 1 || !hasNonStandardConditions) {
    return false;
  }

  const aggregates = widget.queries.flatMap(query => query.aggregates);
  const unsupportedAggregates = [
    AggregationKey.PERCENTILE,
    AggregationKey.APDEX,
    AggregationKey.FAILURE_RATE,
  ];

  // check if any of the aggregates contains unsupported aggregates as substr
  const hasUnsupportedAggregates = aggregates.some(aggregate =>
    unsupportedAggregates.some(agg => aggregate.includes(agg))
  );

  // currently we only support one aggregate per widget for on-demand metrics
  return aggregates.length > 1 || !hasUnsupportedAggregates;
}

export const shouldUseOnDemandMetrics = (organization: Organization, widget: Widget) => {
  return isOnDemandMetricWidget(widget) && hasOnDemandMetricWidgetFeature(organization);
};
