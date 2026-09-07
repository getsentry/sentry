import type {Query} from 'history';
import * as qs from 'query-string';

import type {ChartUnit} from 'sentry/components/seer/markdown/embeds/components/chartTypes';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';

export type ErrorsQueryData = EmbedOutput<'errorsQuery'>;

const DEFAULT_SAMPLE_FIELDS = [
  'title',
  'event.type',
  'project',
  'user.display',
  'timestamp',
];
const DEFAULT_AGGREGATE_FIELDS = ['title', 'project', 'count()'];

/** Charted when the query has no aggregate of its own to plot. */
const DEFAULT_Y_AXIS = 'count()';

export function buildErrorsEventView(data: ErrorsQueryData) {
  const {
    query,
    mode,
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
      : mode === 'aggregate'
        ? DEFAULT_AGGREGATE_FIELDS
        : DEFAULT_SAMPLE_FIELDS,
    orderby: sort ?? (mode === 'aggregate' ? '-count' : '-timestamp'),
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
 * explicit `yAxes` hint when provided, otherwise the query's own aggregates,
 * and finally a plain event count for queries that have none (every
 * non-aggregate query, and aggregates that only named grouping columns).
 */
export function resolveChartYAxes(data: ErrorsQueryData, fields: string[]): string[] {
  if (data.yAxes?.length) {
    return data.yAxes;
  }

  const aggregates = data.mode === 'aggregate' ? fields.filter(isAggregateFieldName) : [];

  return aggregates.length > 0 ? aggregates : [DEFAULT_Y_AXIS];
}

/**
 * Builds the query params for the events-stats timeseries request, reusing
 * the same query/page-filter params already built for the events table
 * fetch and swapping in the aggregate fields as the y-axis.
 *
 * Dropping `field` and `sort` is what keeps this a total for the period: the
 * endpoint groups by whatever `field` it is given, so sending the query's
 * grouping columns would break the chart into a series per group.
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
