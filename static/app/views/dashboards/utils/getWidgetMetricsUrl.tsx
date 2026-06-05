import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {explodeFieldString, isEquation} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/typesBase';
import {applyDashboardFilters} from 'sentry/views/dashboards/utils';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {getMetricsUrl, makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
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
  if (!widget.queries[0]?.aggregates) {
    // If we can't extract a valid trace metric, return a basic metrics URL
    return makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
  }

  const chartType = getChartTypeFromDisplayType(widget.displayType);

  const metricQueries = widget.queries[0].aggregates
    .flatMap(aggregate => {
      if (isEquation(aggregate)) {
        // Use flatMap because of the queries type, but for an equation we will only have one
        // true query. The other metric queries filters are parsed out from the equation string.
        return widget.queries.flatMap(query => {
          const groupByFields: GroupBy[] = query.columns.map(
            (col): GroupBy => ({groupBy: col})
          );
          const queryString =
            applyDashboardFilters(
              query.conditions,
              dashboardFilters,
              widget.widgetType
            ) ?? '';

          const parsed = parseAggregateExpression(aggregate, queryString);
          const results: BaseMetricQuery[] = [...parsed.metricQueries];
          if (parsed.equationRow) {
            results.push({
              ...parsed.equationRow,
              queryParams: parsed.equationRow.queryParams.replace({
                aggregateFields: [
                  new VisualizeEquation(aggregate, {chartType}),
                  ...groupByFields,
                ],
              }),
            });
          }
          return results;
        });
      }

      return widget.queries.map(query => {
        const queryString =
          applyDashboardFilters(query.conditions, dashboardFilters, widget.widgetType) ??
          '';

        const groupByFields: GroupBy[] = query.columns.map(
          (col): GroupBy => ({groupBy: col})
        );

        const aggregateSortBys = query.orderby ? decodeSorts(query.orderby) : [];

        const aggregateFields: AggregateField[] = [
          new VisualizeFunction(aggregate, {chartType}),
          ...groupByFields,
        ];

        const traceMetric = extractTraceMetricFromColumn(explodeFieldString(aggregate));
        if (!traceMetric) {
          return;
        }

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
    })
    .filter(defined);

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
