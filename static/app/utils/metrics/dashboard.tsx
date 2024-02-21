import {urlEncode} from '@sentry/utils';

import type {MRI, PageFilters} from 'sentry/types';
import {emptyWidget, NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {MRIToField, parseField} from 'sentry/utils/metrics/mri';
import type {MetricsQuery, MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import type {Widget} from 'sentry/views/dashboards/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';

export function convertToDashboardWidget(
  metricQueries: MetricsQuery[],
  displayType?: MetricDisplayType,
  title = ''
): Widget {
  // @ts-expect-error TODO: pass interval
  return {
    title,
    displayType: toDisplayType(displayType),
    widgetType: WidgetType.METRICS,
    limit: 10,
    queries: metricQueries.map(getWidgetQuery),
  };
}

export function convertToMetricWidget(widget: Widget): MetricWidgetQueryParams[] {
  return widget.queries.map(query => {
    const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

    return {
      id: NO_QUERY_ID,
      mri: parsed.mri,
      op: parsed.op,
      query: query.conditions,
      groupBy: query.columns,
      displayType: toMetricDisplayType(widget.displayType),
    };
  });
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
  return convertToDashboardWidget(
    [{...selection, ...emptyWidget}],
    MetricDisplayType.LINE
  );
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
