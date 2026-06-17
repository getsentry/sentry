import {useCallback, useMemo} from 'react';

import type {PageFilters} from 'sentry/types/core';
import {explodeField} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {getExploreUrl} from 'sentry/views/explore/utils';

/**
 * Builds the "open in Explore" link for a dashboard heat map's cell tooltip:
 * each cell deep-links to its metric in Explore, scoped to the cell's query.
 * The metric comes from the selected Visualize aggregate. Returns `undefined`
 * when the widget has no resolvable metric (so the link is omitted). Only heat
 * maps have per-cell tooltips, so no other widget type needs this.
 */
export function useHeatmapExploreUrl(
  widget: Widget
): ((cellQuery: string, filteredSelection: PageFilters) => string) | undefined {
  const organization = useOrganization();
  const query = widget.queries[0];

  const traceMetric = useMemo(() => {
    const selectedIndex = getSelectedAggregateIndex(
      query?.selectedAggregate,
      query?.aggregates.length ?? 0
    );
    const aggregate = query?.aggregates?.[selectedIndex];
    return aggregate
      ? extractTraceMetricFromColumn(explodeField({field: aggregate}))
      : undefined;
  }, [query]);

  const makeExploreUrl = useCallback(
    (cellQuery: string, filteredSelection: PageFilters) => {
      if (!traceMetric) {
        return '';
      }
      const combinedQuery = [query?.conditions, cellQuery].filter(Boolean).join(' ');
      return getExploreUrl({
        organization,
        selection: filteredSelection,
        crossEvents: [{type: 'metrics', metric: traceMetric, query: combinedQuery}],
      });
    },
    [organization, traceMetric, query?.conditions]
  );

  return traceMetric ? makeExploreUrl : undefined;
}
