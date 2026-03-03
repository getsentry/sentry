import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {applyDashboardFilters} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromWidget} from 'sentry/views/dashboards/utils/extractTraceMetricFromWidget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {getMetricsUrl, makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

/**
 * Converts a TRACEMETRICS dashboard widget to a metrics page URL
 */
export function getWidgetMetricsUrl(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization
): string {
  const traceMetric = extractTraceMetricFromWidget(widget);

  if (!traceMetric?.name || !widget.queries[0]?.aggregates) {
    // If we can't extract a valid trace metric, return a basic metrics URL
    return makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
  }

  const chartType = getChartTypeFromDisplayType(widget.displayType);

  const metricQueries: BaseMetricQuery[] = widget.queries[0].aggregates.flatMap(
    aggregate => {
      // For each aggregate, create a metric query for each widget query
      return widget.queries.map(query => {
        const queryString =
          applyDashboardFilters(query.conditions, dashboardFilters, widget.widgetType) ??
          '';

        const groupByFields: GroupBy[] = query.columns.map(
          (col): GroupBy => ({groupBy: col})
        );

        const aggregateSortBys: Sort[] = query.orderby ? decodeSorts(query.orderby) : [];

        const aggregateFields: AggregateField[] = [
          new VisualizeFunction(aggregate, {chartType}),
          ...groupByFields,
        ];

        return {
          metric: traceMetric,
          queryParams: new ReadableQueryParams({
            extrapolate: true,
            mode: Mode.AGGREGATE,
            query: queryString,
            aggregateCursor: '',
            aggregateFields,
            aggregateSortBys,

            // These fields are not currently used for metrics
            fields: [],
            sortBys: [],
            cursor: '',
          }),
        };
      });
    }
  );

  return getMetricsUrl({
    organization,
    selection,
    metricQueries,
    title: widget.title,
    referrer: 'dashboards',
  });
}

function getChartTypeFromDisplayType(displayType: DisplayType): ChartType {
  switch (displayType) {
    case DisplayType.LINE:
      return ChartType.LINE;
    case DisplayType.AREA:
      return ChartType.AREA;
    case DisplayType.BAR:
      return ChartType.BAR;
    case DisplayType.TABLE:
    case DisplayType.BIG_NUMBER:
    default:
      return ChartType.LINE;
  }
}
