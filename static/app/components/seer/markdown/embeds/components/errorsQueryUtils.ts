import type {Query} from 'history';
import * as qs from 'query-string';

import type {ChartUnit} from 'sentry/components/seer/markdown/embeds/components/chartTypes';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';

export type ErrorsQueryKind = 'aggregate' | 'events';
export type ErrorsQueryData =
  | EmbedOutput<'errorsQuery'>
  | EmbedOutput<'errorsQueryAggregate'>;

const DEFAULT_EVENT_FIELDS = [
  'title',
  'event.type',
  'project',
  'user.display',
  'timestamp',
];
const DEFAULT_AGGREGATE_FIELDS = ['title', 'project', 'count()'];

export function buildErrorsEventView(data: ErrorsQueryData, kind: ErrorsQueryKind) {
  const {
    query,
    fields,
    yAxes,
    sort,
    title,
    projects,
    environments,
    statsPeriod,
    start,
    end,
  } = data;

  return EventView.fromSavedQuery({
    version: 2,
    name: title ?? t('Errors'),
    query,
    fields: fields?.length
      ? fields
      : kind === 'aggregate'
        ? DEFAULT_AGGREGATE_FIELDS
        : DEFAULT_EVENT_FIELDS,
    orderby: sort ?? (kind === 'aggregate' ? '-count' : '-timestamp'),
    projects: projects?.map(Number),
    environment: environments,
    range: statsPeriod,
    start,
    end,
    yAxis: yAxes,
    queryDataset: SavedQueryDatasets.ERRORS,
  });
}

export function getErrorsQueryHref(
  eventView: EventView,
  organization: Organization
): string {
  const target = eventView.getResultsViewUrlTarget(
    organization,
    false,
    SavedQueryDatasets.ERRORS
  );

  return `${target.pathname}?${qs.stringify(target.query, {skipNull: true})}`;
}

const AGGREGATE_FIELD_PATTERN = /\(.*\)/;

function isAggregateFieldName(field: string): boolean {
  return AGGREGATE_FIELD_PATTERN.test(field);
}

/**
 * An aggregate errors query has "no group by" when every resolved field is
 * an aggregate function call (no plain grouping columns remain). That
 * collapses the results to a single row today, which reads better as a
 * chart than a one-row table.
 */
export function hasNoGroupBy(fields: string[]): boolean {
  return fields.length > 0 && fields.every(isAggregateFieldName);
}

/**
 * Resolves which fields should drive the chart's y-axis: the schema's
 * explicit `yAxes` hint when provided, otherwise the aggregate fields
 * themselves (all of `fields` is aggregate in chart mode).
 */
export function resolveChartYAxes(data: ErrorsQueryData, fields: string[]): string[] {
  return data.yAxes?.length ? data.yAxes : fields;
}

/**
 * Builds the query params for the events-stats timeseries request, reusing
 * the same query/page-filter params already built for the events table
 * fetch and swapping in the aggregate fields as the y-axis.
 */
export function buildErrorsChartQuery(eventView: EventView, yAxis: string[]): Query {
  const {
    field: _field,
    sort: _sort,
    widths: _widths,
    ...rest
  } = eventView.generateQueryStringObject();

  return {...rest, yAxis};
}

export function toChartUnit(outputType: AggregationOutputType): ChartUnit {
  switch (outputType) {
    case 'duration':
      return 'duration';
    case 'percentage':
      return 'percentage';
    case 'size':
      return 'bytes';
    default:
      return 'number';
  }
}
