import {urlEncode} from '@sentry/utils';

import type {PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {MRIToField} from 'sentry/utils/metrics/mri';
import type {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics/types';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';

export function convertToDashboardWidget(
  metricQueries: ((MetricsQuery & {id?: number}) | {formula: string})[],
  displayType?: MetricDisplayType,
  title = ''
): Widget {
  // @ts-expect-error TODO: pass interval
  return {
    title,
    displayType: toDisplayType(displayType),
    widgetType: WidgetType.METRICS,
    limit: 10,
    queries: metricQueries.map(query =>
      'formula' in query ? getWidgetEquation(query.formula) : getWidgetQuery(query)
    ),
  };
}

export function toDisplayType(displayType: unknown): DisplayType {
  if (Object.values(DisplayType).includes(displayType as DisplayType)) {
    return displayType as DisplayType;
  }
  return DisplayType.LINE;
}

export function getWidgetQuery(metricsQuery: MetricsQuery & {id?: number}): WidgetQuery {
  const field = MRIToField(metricsQuery.mri, metricsQuery.op);
  return {
    name: defined(metricsQuery.id) ? `${metricsQuery.id}` : '',
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    orderby: 'desc',
  };
}

export function getWidgetEquation(equation: string): WidgetQuery {
  return {
    name: '',
    aggregates: [`equation|${equation}`],
    columns: [],
    fields: [`equation|${equation}`],
    conditions: '',
    orderby: 'desc',
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
  selection: PageFilters,
  urlWidgetQuery: string,
  displayType?: MetricDisplayType
) {
  const {start, end, period} = selection.datetime;
  const {projects} = selection;

  return {
    source: DashboardWidgetSource.DDM,
    start,
    end,
    statsPeriod: period,
    defaultWidgetQuery: urlWidgetQuery,
    defaultTableColumns: [],
    defaultTitle: '',
    environment: selection.environments,
    displayType,
    project: projects,
  };
}
