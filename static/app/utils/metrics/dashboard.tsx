import {urlEncode} from '@sentry/utils';

import {
  getFieldFromMetricsQuery,
  isCustomMetric,
  MetricDisplayType,
  MetricsQuery,
} from 'sentry/utils/metrics';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {DashboardWidgetSource, Widget, WidgetType} from 'sentry/views/dashboards/types';

const getDDMWidgetName = (metricsQuery: MetricsQuery) => {
  return `${metricsQuery.op}(${formatMRI(metricsQuery.mri)})`;
};

export function convertToDashboardWidget(
  metricsQuery: MetricsQuery,
  displayType?: MetricDisplayType
): Widget {
  const isCustomMetricQuery = isCustomMetric(metricsQuery);

  return {
    title: getDDMWidgetName(metricsQuery),
    // @ts-expect-error this is a valid widget type
    displayType,
    widgetType: isCustomMetricQuery ? WidgetType.METRICS : WidgetType.DISCOVER,
    limit: !metricsQuery.groupBy?.length ? 1 : 10,
    queries: [getWidgetQuery(metricsQuery)],
  };
}

export function getWidgetQuery(metricsQuery: MetricsQuery) {
  const field = getFieldFromMetricsQuery(metricsQuery);

  return {
    name: '',
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    orderby: '',
  };
}

export function encodeWidgetQuery(query) {
  return urlEncode({
    ...query,
    aggregates: query.aggregates.join(','),
    fields: query.fields?.join(','),
    columns: query.columns.join(','),
  });
}

export function getWidgetAsQueryParams(
  metricsQuery: MetricsQuery,
  urlWidgetQuery: string,
  displayType?: MetricDisplayType
) {
  const {start, end, period} = metricsQuery.datetime;
  const {projects} = metricsQuery;

  return {
    source: DashboardWidgetSource.DDM,
    start,
    end,
    statsPeriod: period,
    defaultWidgetQuery: urlWidgetQuery,
    defaultTableColumns: [],
    defaultTitle: getDDMWidgetName(metricsQuery),
    environment: metricsQuery.environments,
    displayType,
    project: projects,
  };
}
