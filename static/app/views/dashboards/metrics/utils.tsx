import type {MRI} from 'sentry/types';
import {NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {parseField} from 'sentry/utils/metrics/mri';
import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiRequestQuery} from 'sentry/utils/metrics/useMetricsQuery';
import type {Order} from 'sentry/views/dashboards/metrics/types';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {getQuerySymbol} from 'sentry/views/ddm/querySymbol';

function extendQuery(query = '', dashboardFilters?: DashboardFilters) {
  if (!dashboardFilters?.release?.length) {
    return query;
  }

  const releaseQuery = getReleaseQuery(dashboardFilters);

  return `${query} ${releaseQuery}`.trim();
}

function getReleaseQuery(dashboardFilters: DashboardFilters) {
  const {release} = dashboardFilters;

  if (!release?.length) {
    return '';
  }

  if (release.length === 1) {
    return `release:${release[0]}`;
  }

  return `release:[${release.join(',')}]`;
}

export function getMetricQueries(
  widget: Widget,
  dashboardFilters?: DashboardFilters
): MetricsQueryApiRequestQuery[] {
  return widget.queries.map((query, index) => {
    const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};
    const orderBy = query.orderby ? query.orderby : undefined;
    return {
      type: MetricQueryType.QUERY,
      id: NO_QUERY_ID,
      mri: parsed.mri,
      op: parsed.op,
      query: extendQuery(query.conditions, dashboardFilters),
      groupBy: query.columns,
      name: query.name || getQuerySymbol(index),
      orderBy: orderBy as Order,
    };
  });
}

export function toMetricDisplayType(displayType: unknown): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}
