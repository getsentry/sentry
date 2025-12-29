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
import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {getMetricsUrl, makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
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
  // Extract trace metric from the first query's first aggregate
  const traceMetric = extractTraceMetricFromWidget(widget);

  if (!traceMetric?.name) {
    // If we can't extract a valid trace metric, return a basic metrics URL
    return makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
  }

  // Map widget display type to chart type
  const chartType = getChartTypeFromDisplayType(widget.displayType);

  // Build metric queries for each widget query
  const metricQueries: BaseMetricQuery[] = widget.queries.map(query => {
    const defaultQuery = defaultMetricQuery();

    // Build aggregate fields (visualizations + group bys)
    const aggregateFields = [
      // Convert aggregates to VisualizeFunction objects
      ...query.aggregates.map(agg => new VisualizeFunction(agg, {chartType})),
      // Group by columns are added as-is (they're already strings)
      ...query.columns.map(col => col),
    ];

    // Parse sorts from orderby
    const aggregateSortBys: Sort[] = query.orderby
      ? decodeSorts(query.orderby)
      : [...defaultQuery.queryParams.aggregateSortBys];

    // Apply dashboard filters to the query conditions
    const queryString = applyDashboardFilters(query.conditions, dashboardFilters) ?? '';

    return {
      metric: traceMetric,
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: queryString,
        cursor: '',
        fields: defaultQuery.queryParams.fields,
        sortBys: defaultQuery.queryParams.sortBys,
        aggregateCursor: '',
        aggregateFields: aggregateFields as readonly AggregateField[],
        aggregateSortBys,
      }),
    };
  });

  // Generate the metrics URL using the shared utility
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

  // Arguments: [value, metric_name, metric_type, unit]
  const name = parsedFunction.arguments[1] ?? '';
  const type = parsedFunction.arguments[2] ?? '';

  return {name, type};
}

/**
 * Maps dashboard DisplayType to metrics ChartType
 */
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
