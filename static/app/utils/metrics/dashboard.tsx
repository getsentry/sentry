import {urlEncode} from '@sentry/utils';

import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {MRIToField} from 'sentry/utils/metrics/mri';
import type {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics/types';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

interface QueryParams extends MetricsQuery {
  id?: number;
  isHidden?: boolean;
}

interface EquationParams {
  formula: string;
  isHidden?: boolean;
}

export function convertToDashboardWidget(
  metricQueries: (QueryParams | EquationParams)[],
  displayType?: MetricDisplayType,
  title = ''
): Widget {
  // TODO: Ged rid of ts-expect-error
  // @ts-ignore TS(2741): Property 'interval' is missing in type '{ title: s... Remove this comment to see the full error message
  return {
    title,
    displayType: toDisplayType(displayType),
    widgetType: WidgetType.METRICS,
    limit: 10,
    queries: metricQueries.map(query =>
      'formula' in query ? getWidgetEquation(query) : getWidgetQuery(query)
    ),
  };
}

export function toDisplayType(displayType: unknown): DisplayType {
  if (Object.values(DisplayType).includes(displayType as DisplayType)) {
    return displayType as DisplayType;
  }
  return DisplayType.LINE;
}

export function getWidgetQuery(metricsQuery: QueryParams): WidgetQuery {
  const field = MRIToField(metricsQuery.mri, metricsQuery.aggregation);
  return {
    name: defined(metricsQuery.id) ? `${metricsQuery.id}` : '',
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    // @ts-ignore TS(2322): Type 'undefined' is not assignable to type 'string... Remove this comment to see the full error message
    orderby: undefined,
    isHidden: metricsQuery.isHidden,
  };
}

export function getWidgetEquation(equation: EquationParams): WidgetQuery {
  return {
    name: '',
    aggregates: [`equation|${equation.formula}`],
    columns: [],
    fields: [`equation|${equation.formula}`],
    conditions: '',
    // @ts-ignore TS(2322): Type 'undefined' is not assignable to type 'string... Remove this comment to see the full error message
    orderby: undefined,
    isHidden: equation.isHidden,
  };
}

export function encodeWidgetQuery(query: any) {
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
