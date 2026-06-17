import {useMemo} from 'react';

import {explodeField} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

/**
 * Resolves the trace metric a dashboard heat map plots, from its selected
 * Visualize aggregate. The heat map visualization uses it to link each cell's
 * tooltip to the metric in Explore. Returns `undefined` when no aggregate
 * resolves to a metric.
 */
export function useHeatmapTraceMetric(widget: Widget): TraceMetric | undefined {
  const query = widget.queries[0];
  return useMemo(() => {
    const selectedIndex = getSelectedAggregateIndex(
      query?.selectedAggregate,
      query?.aggregates.length ?? 0
    );
    const aggregate = query?.aggregates?.[selectedIndex];
    return aggregate
      ? extractTraceMetricFromColumn(explodeField({field: aggregate}))
      : undefined;
  }, [query]);
}
