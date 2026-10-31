import type {Location} from 'history';
import type {inferParserType} from 'nuqs';

import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateFields} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateSortBys} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCrossEvents} from 'sentry/views/explore/queryParams/crossEvent';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {getFields} from 'sentry/views/explore/queryParams/field';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {getGroupBys, isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {defaultMode} from 'sentry/views/explore/queryParams/mode';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
  parseAsFieldList,
  parseAsMode,
  parseAsRawList,
  parseAsScalar,
  parseAsSingleScalar,
  type QueryParamsUpdates,
} from 'sentry/views/explore/queryParams/parsers';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ID_KEY, TITLE_KEY} from 'sentry/views/explore/queryParams/savedQuery';
import {getSortBys} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {
  getVisualizes,
  isVisualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {canShareChart} from 'sentry/views/explore/spans/sharedChartAggregates';
import {SpanFields} from 'sentry/views/insights/types';

const SPANS_MODE_KEY = 'mode';
const SPANS_QUERY_KEY = 'query';
const SPANS_CURSOR_KEY = 'cursor';
export const SPANS_BREAKDOWN_CURSOR_KEY = 'breakdownCursor';
const SPANS_BREAKDOWN_QUERY_KEY = 'breakdownQuery';
const SPANS_FIELD_KEY = 'field';
const SPANS_SORT_KEY = 'sort';
const SPANS_AGGREGATE_FIELD_KEY = 'aggregateField';
export const SPANS_AGGREGATE_CURSOR = 'aggregateCursor';
const SPANS_GROUP_BY_KEY = 'groupBy';
const SPANS_VISUALIZATION_KEY = 'visualize';
const SPANS_AGGREGATE_SORT_KEY = 'aggregateSort';
const SPANS_EXTRAPOLATE_KEY = 'extrapolate';
const SPANS_ID_KEY = ID_KEY;
const SPANS_TITLE_KEY = TITLE_KEY;
const SPANS_CROSS_EVENTS_KEY = 'crossEvents';

export function useSpansDataset(): DiscoverDatasets {
  return DiscoverDatasets.SPANS;
}

export const SPANS_QUERY_PARSERS = {
  [SPANS_EXTRAPOLATE_KEY]: parseAsScalar,
  [SPANS_MODE_KEY]: parseAsMode,
  [SPANS_QUERY_KEY]: parseAsScalar,
  [SPANS_CURSOR_KEY]: parseAsScalar,
  [SPANS_BREAKDOWN_CURSOR_KEY]: parseAsScalar,
  [SPANS_BREAKDOWN_QUERY_KEY]: parseAsScalar,
  [SPANS_FIELD_KEY]: parseAsFieldList,
  [SPANS_SORT_KEY]: parseAsRawList,
  [SPANS_AGGREGATE_CURSOR]: parseAsScalar,
  [SPANS_AGGREGATE_FIELD_KEY]: parseAsRawList,
  [SPANS_GROUP_BY_KEY]: parseAsRawList,
  [SPANS_VISUALIZATION_KEY]: parseAsRawList,
  [SPANS_AGGREGATE_SORT_KEY]: parseAsRawList,
  [SPANS_ID_KEY]: parseAsScalar,
  [SPANS_TITLE_KEY]: parseAsScalar,
  [SPANS_CROSS_EVENTS_KEY]: parseAsSingleScalar,
};

type SpansQueryValues = inferParserType<typeof SPANS_QUERY_PARSERS>;

export function isDefaultSpansFields(values: SpansQueryValues): boolean {
  return getFields(values[SPANS_FIELD_KEY]) === null;
}

interface SpansQueryParamsOptions {
  /**
   * Plots the y axes listed together in one entry on the same chart when they
   * can share it, instead of giving each its own chart.
   */
  multiAggregateCharts?: boolean;
}

export function getReadableSpansQueryParams(
  values: SpansQueryValues,
  fieldsOverride?: string[],
  options?: SpansQueryParamsOptions
): ReadableQueryParams {
  const extrapolate = (values[SPANS_EXTRAPOLATE_KEY] ?? '1') === '1';
  const mode = values[SPANS_MODE_KEY] ?? defaultMode();
  const query = values[SPANS_QUERY_KEY] ?? '';

  const cursor = values[SPANS_CURSOR_KEY] ?? defaultCursor();
  const breakdownCursor = values[SPANS_BREAKDOWN_CURSOR_KEY] ?? undefined;
  const breakdownQuery = values[SPANS_BREAKDOWN_QUERY_KEY] ?? undefined;
  const fields = fieldsOverride ?? getFields(values[SPANS_FIELD_KEY]) ?? defaultFields();
  const sortBys = getSortBys(values[SPANS_SORT_KEY], fields) ?? defaultSortBys(fields);

  const aggregateCursor = values[SPANS_AGGREGATE_CURSOR] ?? defaultCursor();
  const aggregateFields = getSpansAggregateFields(values, options);
  const aggregateSortBys =
    getAggregateSortBys(values[SPANS_AGGREGATE_SORT_KEY], aggregateFields) ??
    defaultAggregateSortBys(aggregateFields);

  const id = values[SPANS_ID_KEY] ?? undefined;
  const title = values[SPANS_TITLE_KEY] ?? undefined;

  const crossEvents = getCrossEvents(values[SPANS_CROSS_EVENTS_KEY]);

  return new ReadableQueryParams({
    extrapolate,
    mode,
    query,

    cursor,
    breakdownCursor,
    breakdownQuery,
    fields,
    sortBys,

    aggregateCursor,
    aggregateFields,
    aggregateSortBys,

    id,
    title,

    crossEvents,
  });
}

/** @internal used in tests */
export function getReadableQueryParamsFromLocation(
  location: Location,
  fieldsOverride?: string[],
  options?: SpansQueryParamsOptions
): ReadableQueryParams {
  return getReadableSpansQueryParams(
    loadQueryParamsFromLocation(SPANS_QUERY_PARSERS, location),
    fieldsOverride,
    options
  );
}

function encodeSorts(sortBys: readonly Sort[]): string[] {
  return sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`);
}

export function getSpansQueryParamsUpdates(
  writableQueryParams: WritableQueryParams
): QueryParamsUpdates<typeof SPANS_QUERY_PARSERS> {
  const {extrapolate, crossEvents} = writableQueryParams;
  return {
    [SPANS_EXTRAPOLATE_KEY]: defined(extrapolate)
      ? extrapolate
        ? null
        : '0'
      : undefined,
    [SPANS_QUERY_KEY]: writableQueryParams.query,
    [SPANS_MODE_KEY]: writableQueryParams.mode,
    [SPANS_BREAKDOWN_CURSOR_KEY]: writableQueryParams.breakdownCursor,
    [SPANS_BREAKDOWN_QUERY_KEY]: writableQueryParams.breakdownQuery,
    [SPANS_FIELD_KEY]:
      writableQueryParams.fields === null
        ? null
        : writableQueryParams.fields?.filter(Boolean),
    [SPANS_SORT_KEY]:
      writableQueryParams.sortBys === null
        ? null
        : writableQueryParams.sortBys && encodeSorts(writableQueryParams.sortBys),
    [SPANS_AGGREGATE_CURSOR]: writableQueryParams.aggregateCursor,
    [SPANS_AGGREGATE_FIELD_KEY]: writableQueryParams.aggregateFields?.map(
      aggregateField => JSON.stringify(aggregateField)
    ),
    [SPANS_AGGREGATE_SORT_KEY]:
      writableQueryParams.aggregateSortBys === null
        ? null
        : writableQueryParams.aggregateSortBys &&
          encodeSorts(writableQueryParams.aggregateSortBys),
    [SPANS_CROSS_EVENTS_KEY]:
      crossEvents === null
        ? null
        : crossEvents === undefined
          ? undefined
          : JSON.stringify(crossEvents),
  };
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  return applyQueryParamsUpdates(
    SPANS_QUERY_PARSERS,
    location,
    getSpansQueryParamsUpdates(writableQueryParams)
  );
}

function defaultFields(): string[] {
  return [
    SpanFields.ID,
    SpanFields.NAME,
    SpanFields.SPAN_DESCRIPTION,
    SpanFields.SPAN_DURATION,
    SpanFields.TRANSACTION,
    SpanFields.TIMESTAMP,
  ];
}

function defaultSortBys(fields: string[]): Sort[] {
  if (fields.includes('timestamp')) {
    return [
      {
        field: 'timestamp',
        kind: 'desc' as const,
      },
    ];
  }

  if (fields.length) {
    return [
      {
        field: fields[0]!,
        kind: 'desc' as const,
      },
    ];
  }

  return [];
}

function defaultGroupBys(): [GroupBy] {
  return [{groupBy: ''}];
}

export function defaultVisualizes(): [Visualize] {
  return [new VisualizeFunction(DEFAULT_VISUALIZATION)];
}

function getSpansAggregateFields(
  values: SpansQueryValues,
  options?: SpansQueryParamsOptions
): AggregateField[] {
  const parseOptions = options?.multiAggregateCharts
    ? {groupYAxes: canShareChart}
    : undefined;
  const aggregateFields = getAggregateFields(
    values[SPANS_AGGREGATE_FIELD_KEY],
    parseOptions
  );

  if (aggregateFields?.length) {
    let hasGroupBy = false;
    let hasVisualize = false;
    for (const aggregateField of aggregateFields) {
      if (isGroupBy(aggregateField)) {
        hasGroupBy = true;
      } else if (isVisualize(aggregateField)) {
        hasVisualize = true;
      }
    }

    // We have at least 1 group by or 1 visualize, insert some
    // defaults to make sure we have at least 1 of both

    if (!hasGroupBy) {
      aggregateFields.push(...defaultGroupBys());
    }

    if (!hasVisualize) {
      aggregateFields.push(...defaultVisualizes());
    }

    return aggregateFields;
  }

  return [
    ...(getGroupBys(values[SPANS_GROUP_BY_KEY]) ?? defaultGroupBys()),
    ...(getVisualizes(values[SPANS_VISUALIZATION_KEY], parseOptions) ??
      defaultVisualizes()),
  ];
}

function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
  for (const aggregateField of aggregateFields) {
    if (isVisualize(aggregateField)) {
      return [
        {
          field: aggregateField.yAxis,
          kind: 'desc' as const,
        },
      ];
    }
  }

  for (const aggregateField of aggregateFields) {
    if (isGroupBy(aggregateField)) {
      return [
        {
          field: aggregateField.groupBy,
          kind: 'desc' as const,
        },
      ];
    }
  }

  return [];
}
