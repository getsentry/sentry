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
const DEFAULT_AGGREGATE = 'count(span.duration)';

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
 * An aggregate spans query has "no group by" when the schema's explicit
 * `groupBy` is empty or absent. That collapses the results to a single row
 * per y-axis today, which reads better as a chart than a one-row table.
 */
export function hasNoGroupBy(data: SpansQueryData): boolean {
  return data.mode === 'aggregate' && !data.groupBy?.length;
}

/**
 * Resolves which fields should drive the chart's y-axis: the schema's
 * explicit `yAxes` hint when provided, otherwise the resolved query fields
 * themselves (all of `fields` is aggregate when there is no group by).
 */
export function resolveChartYAxes(data: SpansQueryData, fields: string[]): string[] {
  return data.yAxes?.length ? data.yAxes : fields;
}

/**
 * Builds the query params for the events-stats timeseries request, reusing
 * the same query/page-filter params already built for the events table
 * fetch and swapping in the aggregate fields as the y-axis.
 */
export function buildSpansChartQuery(eventView: EventView, yAxis: string[]): Query {
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
