import type {Query} from 'history';

import type {ChartUnit} from 'sentry/components/seer/markdown/embeds/components/chartTypes';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {Organization, NewQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getExploreUrl} from 'sentry/views/explore/utils';

import {toAggregateFields, toMode, toPageFilters} from './queryEmbedParams';

export type SpansQueryData = EmbedOutput<'spansQuery'>;

const DEFAULT_SAMPLE_FIELDS = [
  'span.description',
  'span.op',
  'span.duration',
  'transaction',
  'timestamp',
];

/**
 * Explore's own default visualization, so a query that names no aggregate
 * charts the same series it would on the page the embed links to.
 */
const DEFAULT_AGGREGATE = 'count(span.duration)';

/**
 * How many groups a grouped chart plots. Explore allows nine; the preview
 * matches the row limit of the table underneath it instead, so every series
 * in the legend has a row to read it against.
 */
const CHART_TOP_EVENTS = 5;

export function getSpansQueryFields(data: SpansQueryData): string[] {
  if (data.mode === 'samples') {
    return data.fields?.length ? data.fields : DEFAULT_SAMPLE_FIELDS;
  }

  const yAxes = data.yAxes?.length ? data.yAxes : [DEFAULT_AGGREGATE];
  return Array.from(new Set([...(data.groupBy ?? []).filter(Boolean), ...yAxes]));
}

export function buildSpansEventView(data: SpansQueryData): EventView {
  const fields = getSpansQueryFields(data);
  const defaultSort =
    data.mode === 'aggregate'
      ? `-${getAggregateAlias(data.yAxes?.[0] ?? DEFAULT_AGGREGATE)}`
      : '-timestamp';
  const query: NewQuery = {
    id: undefined,
    name: data.title ?? 'Spans',
    fields,
    orderby: [data.sort ?? defaultSort],
    query: data.query,
    version: 2,
    dataset: DiscoverDatasets.SPANS,
  };

  return EventView.fromNewQueryWithPageFilters(query, toPageFilters(data));
}

export function getSpansQueryHref(
  data: SpansQueryData,
  organization: Organization
): string {
  const {query, mode, sort, fields, groupBy, yAxes} = data;
  const aggregateYAxes =
    mode === 'aggregate' && !yAxes?.length ? [DEFAULT_AGGREGATE] : yAxes;

  return getExploreUrl({
    organization,
    selection: toPageFilters(data),
    query,
    mode: toMode(mode),
    field: fields,
    sort: mode === 'samples' ? sort : undefined,
    aggregateSort: mode === 'aggregate' ? sort : undefined,
    aggregateField: toAggregateFields({groupBy, yAxes: aggregateYAxes}),
  });
}

/**
 * The columns the chart splits its series on. Only an aggregate query groups;
 * a samples query always charts a single total series for the period.
 */
function getChartGroupBy(data: SpansQueryData): string[] {
  return data.mode === 'aggregate' ? (data.groupBy ?? []).filter(Boolean) : [];
}

/**
 * An aggregate spans query has "no group by" when the schema's explicit
 * `groupBy` is empty or absent. That collapses the results to a single row
 * per y-axis today, which reads better as a chart than a one-row table.
 */
export function hasNoGroupBy(data: SpansQueryData): boolean {
  return data.mode === 'aggregate' && getChartGroupBy(data).length === 0;
}

/**
 * Resolves which aggregates drive the chart's y-axis: the schema's explicit
 * `yAxes` hint when provided, otherwise Explore's default visualization —
 * which is also what a samples query, having named no aggregate at all,
 * charts.
 */
export function resolveChartYAxes(data: SpansQueryData): string[] {
  return data.yAxes?.length ? data.yAxes : [DEFAULT_AGGREGATE];
}

function sortsOneOf(sort: string, fields: string[]): boolean {
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  return fields.some(item => item === field || getAggregateAlias(item) === field);
}

/**
 * Builds the query params for the events-stats timeseries request, reusing
 * the same query/page-filter params already built for the events table
 * fetch and swapping in the aggregate fields as the y-axis.
 *
 * A grouped query charts the way Explore does: `field` carries the grouping
 * columns, which is what makes the endpoint break the result into a series
 * per group, and `topEvents` keeps only the leading few. An ungrouped query
 * drops `field` and `sort` instead — the endpoint groups by whatever `field`
 * it is given, so passing the table's columns along would split a plain total
 * into a series per column value.
 */
export function buildSpansChartQuery(
  eventView: EventView,
  data: SpansQueryData,
  yAxes: string[]
): Query {
  const {
    field: _field,
    sort,
    widths: _widths,
    ...rest
  } = eventView.generateQueryStringObject();

  const groupBy = getChartGroupBy(data);
  if (groupBy.length === 0) {
    return {...rest, yAxis: yAxes};
  }

  // Grouping already spends a series per group, so the chart plots a single
  // aggregate rather than multiplying that out by every y-axis.
  const yAxis = yAxes[0] ?? DEFAULT_AGGREGATE;
  const fields = [...groupBy, yAxis];

  // The endpoint ranks the top groups by `sort`, which has to name one of the
  // fields it was given. A query sorted by a y-axis this chart left out does
  // not, so fall back to ranking by the aggregate actually being plotted.
  const sorts = (Array.isArray(sort) ? sort : [sort]).filter(
    (item): item is string => typeof item === 'string' && item !== ''
  );
  const chartSort =
    sorts.find(item => sortsOneOf(item, fields)) ?? `-${getAggregateAlias(yAxis)}`;

  return {
    ...rest,
    yAxis: [yAxis],
    field: fields,
    sort: chartSort,
    topEvents: String(CHART_TOP_EVENTS),
    // The table below lists these same leading groups, so an "Other" series
    // would be the one line in the legend with no row to read it against.
    excludeOther: '1',
  };
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
