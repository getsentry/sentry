import type {Location} from 'history';
import {parseAsString, type inferParserType} from 'nuqs';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {
  getAggregateFieldsFromLocation,
  parseAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  getAggregateSortBysFromLocation,
  validateAggregateSort,
} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCrossEventsFromLocation} from 'sentry/views/explore/queryParams/crossEvent';
import {getCursorFromLocation} from 'sentry/views/explore/queryParams/cursor';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {getModeFromLocation, Mode} from 'sentry/views/explore/queryParams/mode';
import {
  parseAsAggregateFields,
  parseAsCrossEvents,
  parseAsExtrapolate,
  parseAsFields,
  parseAsGroupBys,
  parseAsMode,
  parseAsSortBys,
  parseAsVisualizes,
  serializeQueryParamsToLocation,
} from 'sentry/views/explore/queryParams/nuqsParsers';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ID_KEY, TITLE_KEY} from 'sentry/views/explore/queryParams/savedQuery';
import {
  getSortBysFromLocation,
  validateSort,
} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {
  getVisualizesFromLocation,
  isVisualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {SpanFields} from 'sentry/views/insights/types';

export const SPANS_MODE_KEY = 'mode';
export const SPANS_QUERY_KEY = 'query';
export const SPANS_CURSOR_KEY = 'cursor';
export const SPANS_FIELD_KEY = 'field';
export const SPANS_SORT_KEY = 'sort';
export const SPANS_AGGREGATE_FIELD_KEY = 'aggregateField';
export const SPANS_AGGREGATE_CURSOR = 'aggregateCursor';
export const SPANS_GROUP_BY_KEY = 'groupBy';
export const SPANS_VISUALIZATION_KEY = 'visualize';
export const SPANS_AGGREGATE_SORT_KEY = 'aggregateSort';
export const SPANS_EXTRAPOLATE_KEY = 'extrapolate';
export const SPANS_ID_KEY = ID_KEY;
export const SPANS_TITLE_KEY = TITLE_KEY;
export const SPANS_CROSS_EVENTS_KEY = 'crossEvents';

export const spansQueryParamsParsers = {
  [SPANS_MODE_KEY]: parseAsMode,
  [SPANS_QUERY_KEY]: parseAsString,
  [SPANS_CURSOR_KEY]: parseAsString,
  [SPANS_FIELD_KEY]: parseAsFields,
  [SPANS_SORT_KEY]: parseAsSortBys,
  [SPANS_AGGREGATE_FIELD_KEY]: parseAsAggregateFields,
  [SPANS_AGGREGATE_CURSOR]: parseAsString,
  [SPANS_GROUP_BY_KEY]: parseAsGroupBys,
  [SPANS_VISUALIZATION_KEY]: parseAsVisualizes,
  [SPANS_AGGREGATE_SORT_KEY]: parseAsSortBys,
  [SPANS_EXTRAPOLATE_KEY]: parseAsExtrapolate,
  [SPANS_ID_KEY]: parseAsString,
  [SPANS_TITLE_KEY]: parseAsString,
  [SPANS_CROSS_EVENTS_KEY]: parseAsCrossEvents,
};

export type SpansQueryParams = inferParserType<typeof spansQueryParamsParsers>;

export function useSpansDataset(): DiscoverDatasets {
  return DiscoverDatasets.SPANS;
}

export function isDefaultFields(location: Location): boolean {
  return getFieldsFromLocation(location, SPANS_FIELD_KEY) ? false : true;
}

export function getReadableQueryParamsFromLocation(
  location: Location
): ReadableQueryParams {
  const extrapolate = decodeScalar(location.query?.[SPANS_EXTRAPOLATE_KEY], '1') === '1';
  const mode = getModeFromLocation(location, SPANS_MODE_KEY);
  const query = decodeScalar(location.query[SPANS_QUERY_KEY]) ?? '';

  const cursor = getCursorFromLocation(location, SPANS_CURSOR_KEY);
  const fields = getFieldsFromLocation(location, SPANS_FIELD_KEY) ?? defaultFields();
  const sortBys =
    getSortBysFromLocation(location, SPANS_SORT_KEY, fields) ?? defaultSortBys(fields);

  const aggregateCursor = getCursorFromLocation(location, SPANS_AGGREGATE_CURSOR);
  const aggregateFields = getSpansAggregateFieldsFromLocation(location);
  const aggregateSortBys =
    getAggregateSortBysFromLocation(
      location,
      SPANS_AGGREGATE_SORT_KEY,
      aggregateFields
    ) ?? defaultAggregateSortBys(aggregateFields);

  const id = decodeScalar(location.query[SPANS_ID_KEY]);
  const title = decodeScalar(location.query[SPANS_TITLE_KEY]);

  const crossEvents = getCrossEventsFromLocation(location, SPANS_CROSS_EVENTS_KEY);

  return new ReadableQueryParams({
    extrapolate,
    mode,
    query,

    cursor,
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

export function getReadableQueryParamsFromParsed(
  queryParams: SpansQueryParams
): ReadableQueryParams {
  const extrapolate = queryParams[SPANS_EXTRAPOLATE_KEY] ?? true;
  const mode = queryParams[SPANS_MODE_KEY] ?? defaultMode();
  const query = queryParams[SPANS_QUERY_KEY] ?? '';

  const cursor = queryParams[SPANS_CURSOR_KEY] ?? defaultCursor();
  const fields = queryParams[SPANS_FIELD_KEY] ?? defaultFields();
  const sortBys =
    getValidSortBys(queryParams[SPANS_SORT_KEY], fields) ?? defaultSortBys(fields);

  const aggregateCursor = queryParams[SPANS_AGGREGATE_CURSOR] ?? defaultCursor();
  const aggregateFields = getSpansAggregateFieldsFromParsed(queryParams);
  const aggregateSortBys =
    getValidAggregateSortBys(queryParams[SPANS_AGGREGATE_SORT_KEY], aggregateFields) ??
    defaultAggregateSortBys(aggregateFields);

  return new ReadableQueryParams({
    extrapolate,
    mode,
    query,

    cursor,
    fields,
    sortBys,

    aggregateCursor,
    aggregateFields,
    aggregateSortBys,

    id: queryParams[SPANS_ID_KEY] ?? undefined,
    title: queryParams[SPANS_TITLE_KEY] ?? undefined,

    crossEvents: queryParams[SPANS_CROSS_EVENTS_KEY] ?? undefined,
  });
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  return serializeQueryParamsToLocation(
    location,
    spansQueryParamsParsers,
    getSpansQueryParamsUpdate(writableQueryParams)
  );
}

export function getSpansQueryParamsUpdate(writableQueryParams: WritableQueryParams) {
  const update: Partial<Record<keyof typeof spansQueryParamsParsers, any>> = {};

  if (defined(writableQueryParams.extrapolate)) {
    update[SPANS_EXTRAPOLATE_KEY] = writableQueryParams.extrapolate ? null : false;
  }
  if (defined(writableQueryParams.query) || writableQueryParams.query === null) {
    update[SPANS_QUERY_KEY] = writableQueryParams.query;
  }
  if (defined(writableQueryParams.mode) || writableQueryParams.mode === null) {
    update[SPANS_MODE_KEY] = writableQueryParams.mode;
  }
  if (defined(writableQueryParams.cursor) || writableQueryParams.cursor === null) {
    update[SPANS_CURSOR_KEY] = writableQueryParams.cursor;
  }
  if (
    defined(writableQueryParams.aggregateCursor) ||
    writableQueryParams.aggregateCursor === null
  ) {
    update[SPANS_AGGREGATE_CURSOR] = writableQueryParams.aggregateCursor;
  }
  if (defined(writableQueryParams.fields) || writableQueryParams.fields === null) {
    update[SPANS_FIELD_KEY] =
      writableQueryParams.fields === null
        ? null
        : writableQueryParams.fields.filter(Boolean);
  }
  if (defined(writableQueryParams.sortBys) || writableQueryParams.sortBys === null) {
    update[SPANS_SORT_KEY] = writableQueryParams.sortBys;
  }
  if (
    defined(writableQueryParams.aggregateFields) ||
    writableQueryParams.aggregateFields === null
  ) {
    update[SPANS_AGGREGATE_FIELD_KEY] = writableQueryParams.aggregateFields;
    update[SPANS_GROUP_BY_KEY] = null;
    update[SPANS_VISUALIZATION_KEY] = null;
  }
  if (
    defined(writableQueryParams.aggregateSortBys) ||
    writableQueryParams.aggregateSortBys === null
  ) {
    update[SPANS_AGGREGATE_SORT_KEY] = writableQueryParams.aggregateSortBys;
  }
  if (
    defined(writableQueryParams.crossEvents) ||
    writableQueryParams.crossEvents === null
  ) {
    update[SPANS_CROSS_EVENTS_KEY] = writableQueryParams.crossEvents;
  }

  return update;
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

function defaultMode() {
  return Mode.SAMPLES;
}

function defaultCursor() {
  return '';
}

function getValidSortBys(sortBys: Sort[] | null, fields: string[]): Sort[] | null {
  if (sortBys?.length && sortBys.every(sort => validateSort(sort, fields))) {
    return sortBys;
  }

  return null;
}

function getValidAggregateSortBys(
  sortBys: Sort[] | null,
  aggregateFields: AggregateField[]
): Sort[] | null {
  if (
    sortBys?.length &&
    sortBys.every(sort => validateAggregateSort(sort, aggregateFields))
  ) {
    return sortBys;
  }

  return null;
}

function defaultGroupBys(): [GroupBy] {
  return [{groupBy: ''}];
}

export function defaultVisualizes(): [Visualize] {
  return [new VisualizeFunction(DEFAULT_VISUALIZATION)];
}

function getSpansAggregateFieldsFromLocation(location: Location): AggregateField[] {
  const aggregateFields = getAggregateFieldsFromLocation(
    location,
    SPANS_AGGREGATE_FIELD_KEY
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
    ...(getGroupBysFromLocation(location, SPANS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(location, SPANS_VISUALIZATION_KEY) ??
      defaultVisualizes()),
  ];
}

function getSpansAggregateFieldsFromParsed(
  queryParams: SpansQueryParams
): AggregateField[] {
  const aggregateFields = queryParams[SPANS_AGGREGATE_FIELD_KEY];

  if (aggregateFields?.length) {
    return withRequiredAggregateFields(normalizeAggregateFields(aggregateFields));
  }

  return [
    ...(queryParams[SPANS_GROUP_BY_KEY] ?? defaultGroupBys()),
    ...(queryParams[SPANS_VISUALIZATION_KEY] ?? defaultVisualizes()),
  ];
}

function normalizeAggregateFields(aggregateFields: readonly any[]): AggregateField[] {
  return aggregateFields.flatMap(aggregateField => {
    if (isGroupBy(aggregateField) || isVisualize(aggregateField)) {
      return [aggregateField];
    }

    return parseAggregateField(aggregateField);
  });
}

function withRequiredAggregateFields(
  aggregateFields: AggregateField[]
): AggregateField[] {
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
