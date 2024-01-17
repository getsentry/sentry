import {urlEncode} from '@sentry/utils';

import {PageFilters} from 'sentry/types';
import {emptyWidget, MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {formatMRI, MRIToField} from 'sentry/utils/metrics/mri';
import {
  DashboardWidgetSource,
  DisplayType,
  Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';

const getDDMWidgetName = (metricsQuery: MetricsQuery) => {
  return `${metricsQuery.op}(${formatMRI(metricsQuery.mri)})`;
};

export function convertToDashboardWidget(
  metricsQuery: MetricsQuery,
  displayType?: MetricDisplayType
): Widget {
  // @ts-expect-error TODO: pass interval
  return {
    title: metricsQuery.title || getDDMWidgetName(metricsQuery),
    displayType: toDisplayType(displayType),
    widgetType: WidgetType.METRICS,
    limit: !metricsQuery.groupBy?.length ? 1 : 10,
    queries: [getWidgetQuery(metricsQuery)],
  };
}

export function toMetricDisplayType(displayType: unknown): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}

export function toDisplayType(displayType: unknown): DisplayType {
  if (Object.values(DisplayType).includes(displayType as DisplayType)) {
    return displayType as DisplayType;
  }
  return DisplayType.LINE;
}

export function defaultMetricWidget(selection: PageFilters) {
  return convertToDashboardWidget({...selection, ...emptyWidget}, MetricDisplayType.LINE);
}

export function getWidgetQuery(metricsQuery: MetricsQuery) {
  const field = MRIToField(metricsQuery.mri, metricsQuery.op || '');

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
