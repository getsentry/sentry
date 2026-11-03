import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {Organization, NewQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
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

function getSpansQueryFields(data: SpansQueryData): string[] {
  if (data.mode === 'samples') {
    return data.fields?.length ? data.fields : DEFAULT_SAMPLE_FIELDS;
  }

  const yAxes = data.yAxes?.length ? data.yAxes : [DEFAULT_AGGREGATE];
  return Array.from(new Set([...(data.groupBy ?? []).filter(Boolean), ...yAxes]));
}

// Seer sends one `sort`, but its two consumers spell an aggregate
// differently: the events API wants the alias `p95_span_duration`, while
// Explore's `aggregateSort` param is validated by exact match against the
// page's own y-axis and group-by values and so only accepts
// `p95(span.duration)`. Neither side reports a mismatch, and neither tolerates
// a sort that names no selected field — Explore silently drops one and falls
// back to its default ordering, while the events API rejects the whole request
// with "Cannot sort by a field that is not selected". So normalize at each
// edge instead of trusting the spelling that arrived, and fall back to the
// default ordering rather than forwarding a sort the fields don't name.

/** Finds which of `fields` a sort names, in either spelling. */
function findSortedField(sort: string, fields: string[]): string | undefined {
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  return fields.find(item => item === field || getAggregateAlias(item) === field);
}

/** Alias spelling, for the events API. Unrecognised sorts fall back. */
function toEventsApiSort(
  sort: string | undefined,
  fields: string[],
  fallback: string
): string {
  if (!sort) {
    return fallback;
  }

  const field = findSortedField(sort, fields);
  return field
    ? `${sort.startsWith('-') ? '-' : ''}${getAggregateAlias(field)}`
    : fallback;
}

/** Field spelling, for Explore's URL. Unrecognised sorts are dropped. */
function toExploreAggregateSort(
  sort: string | undefined,
  aggregateFields: string[]
): string | undefined {
  if (!sort) {
    return undefined;
  }

  const field = findSortedField(sort, aggregateFields);
  return field ? `${sort.startsWith('-') ? '-' : ''}${field}` : undefined;
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
    orderby: [toEventsApiSort(data.sort, fields, defaultSort)],
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
  const {query, mode, sort, fields, groupBy, transformations, interval} = data;
  const aggregateYAxes = resolveChartYAxes(data);

  return getExploreUrl({
    organization,
    selection: toPageFilters(data),
    query,
    interval,
    mode: toMode(mode),
    field: fields,
    sort: mode === 'samples' ? sort : undefined,
    aggregateSort:
      mode === 'aggregate'
        ? toExploreAggregateSort(sort, [
            ...(groupBy ?? []).filter(Boolean),
            ...aggregateYAxes,
          ])
        : undefined,
    aggregateField: toAggregateFields({
      groupBy,
      yAxes: aggregateYAxes,
      transformations,
    }),
  });
}

/**
 * An aggregate spans query has "no group by" when the schema's explicit
 * `groupBy` is empty or absent. That collapses the results to a single row
 * per y-axis today, which reads better as a chart than a one-row table.
 */
export function hasNoGroupBy(data: SpansQueryData): boolean {
  return data.mode === 'aggregate' && !(data.groupBy ?? []).some(Boolean);
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
