import {explodeField, type Column} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

/**
 * Returns the widget's selected "Visualize" aggregate — the one picked by the
 * radio selection (`selectedAggregate`) for single-aggregate display types like
 * heat maps — exploded into a `Column`. Returns undefined when there's no
 * aggregate. Callers that need the trace metric pass the result to
 * `extractTraceMetricFromColumn`.
 */
export function getSelectedAggregate(widget: Widget): Column | undefined {
  const query = widget.queries[0];
  const selectedIndex = getSelectedAggregateIndex(
    query?.selectedAggregate,
    query?.aggregates.length ?? 0
  );
  const aggregate = query?.aggregates?.[selectedIndex];
  return aggregate ? explodeField({field: aggregate}) : undefined;
}
