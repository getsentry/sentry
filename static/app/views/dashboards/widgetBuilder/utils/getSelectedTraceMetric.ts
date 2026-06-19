import {explodeField} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

/**
 * Resolves the trace metric from a widget's selected "Visualize" aggregate —
 * the one picked by the radio selection (`selectedAggregate`) for single-
 * aggregate display types like heat maps. Returns undefined when the selected
 * aggregate doesn't encode a metric.
 */
export function getSelectedTraceMetric(widget: Widget): TraceMetric | undefined {
  const query = widget.queries[0];
  const selectedIndex = getSelectedAggregateIndex(
    query?.selectedAggregate,
    query?.aggregates.length ?? 0
  );
  const aggregate = query?.aggregates?.[selectedIndex];
  return aggregate
    ? extractTraceMetricFromColumn(explodeField({field: aggregate}))
    : undefined;
}
