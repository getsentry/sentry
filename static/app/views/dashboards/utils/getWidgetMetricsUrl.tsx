import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {applyDashboardFilters} from 'sentry/views/dashboards/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {
  BaseMetricQuery,
  TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
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
          applyDashboardFilters(query.conditions, dashboardFilters) ?? '';

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

/**
 * Extracts TraceMetric information from a TRACEMETRICS widget's aggregates
 */
function extractTraceMetricFromWidget(widget: Widget): TraceMetric | null {
  const firstQuery = widget.queries[0];
  if (!firstQuery?.aggregates || firstQuery.aggregates.length === 0) {
    return null;
  }

  // Parse the first aggregate to extract metric name and type
  // TRACEMETRICS aggregates are in format: avg(value,metric_name,metric_type,-)
  const firstAggregate = firstQuery.aggregates[0] ?? '';
  const parsedFunction = parseFunction(firstAggregate);

  if (!parsedFunction?.arguments || parsedFunction.arguments.length < 3) {
    return null;
  }

  const name = parsedFunction.arguments[1] ?? '';
  const type = parsedFunction.arguments[2] ?? '';

  return {name, type};
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
