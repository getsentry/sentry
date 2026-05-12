import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateFieldsFromLocation} from 'sentry/views/explore/queryParams/aggregateField';
import {validateAggregateSort} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {getCrossEventsFromLocation} from 'sentry/views/explore/queryParams/crossEvent';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  getVisualizesFromLocation,
  isVisualize,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpanFields} from 'sentry/views/insights/types';

const NUQS_PARSERS = {
  mode: parseAsString,
  query: parseAsString.withDefault(''),
  cursor: parseAsString.withDefault(''),
  field: parseAsArrayOf(parseAsString),
  sort: parseAsArrayOf(parseAsString),
  aggregateField: parseAsArrayOf(parseAsString),
  aggregateSort: parseAsArrayOf(parseAsString),
  extrapolate: parseAsString,
  id: parseAsString,
  title: parseAsString,
  crossEvents: parseAsString,
  aggregateCursor: parseAsString.withDefault(''),
};

interface SpansQueryParamsProviderProps {
  children: ReactNode;
}

export function SpansQueryParamsProvider({children}: SpansQueryParamsProviderProps) {
  const [params, setParams] = useQueryStates(NUQS_PARSERS);

  const readableQueryParams = useMemo(() => {
    return buildReadableQueryParams(params);
  }, [params]);

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const updates: Record<string, string | string[] | null> = {};

      // extrapolate: boolean handling — true means default (delete param), false means '0'
      if (defined(writableQueryParams.extrapolate)) {
        updates.extrapolate = writableQueryParams.extrapolate ? null : '0';
      }

      if (writableQueryParams.query !== undefined) {
        updates.query = writableQueryParams.query;
      }

      if (writableQueryParams.mode !== undefined) {
        updates.mode = writableQueryParams.mode;
      }

      if (writableQueryParams.cursor !== undefined) {
        updates.cursor = writableQueryParams.cursor;
      }

      if (writableQueryParams.aggregateCursor !== undefined) {
        updates.aggregateCursor = writableQueryParams.aggregateCursor;
      }

      if (writableQueryParams.fields !== undefined) {
        updates.field =
          writableQueryParams.fields === null
            ? null
            : writableQueryParams.fields.filter(Boolean);
      }

      if (writableQueryParams.sortBys !== undefined) {
        updates.sort =
          writableQueryParams.sortBys === null
            ? null
            : writableQueryParams.sortBys.map(
                sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
              );
      }

      if (writableQueryParams.aggregateFields !== undefined) {
        updates.aggregateField =
          writableQueryParams.aggregateFields === null
            ? null
            : writableQueryParams.aggregateFields.map(aggregateField =>
                JSON.stringify(aggregateField)
              );
      }

      if (writableQueryParams.aggregateSortBys !== undefined) {
        updates.aggregateSort =
          writableQueryParams.aggregateSortBys === null
            ? null
            : writableQueryParams.aggregateSortBys.map(
                sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
              );
      }

      if (writableQueryParams.crossEvents !== undefined) {
        updates.crossEvents =
          writableQueryParams.crossEvents === null
            ? null
            : JSON.stringify(writableQueryParams.crossEvents);
      }

      setParams(updates);
    },
    [setParams]
  );

  const isUsingDefaultFields = params.field === null;

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={isUsingDefaultFields}
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      shouldManageFields
    >
      {children}
    </QueryParamsContextProvider>
  );
}

/**
 * Build ReadableQueryParams from nuqs state values.
 * This mirrors the logic in getReadableQueryParamsFromLocation but works
 * with the parsed nuqs values instead of a Location object.
 */
function buildReadableQueryParams(params: {
  aggregateCursor: string;
  aggregateField: string[] | null;
  aggregateSort: string[] | null;
  crossEvents: string | null;
  cursor: string;
  extrapolate: string | null;
  field: string[] | null;
  id: string | null;
  mode: string | null;
  query: string;
  sort: string[] | null;
  title: string | null;
}): ReadableQueryParams {
  // Build a minimal location-like object so we can reuse the existing parsers
  // for complex fields (aggregateFields, crossEvents, etc.)
  const locationQuery: Record<string, string | string[] | undefined> = {};

  if (params.aggregateField !== null) {
    locationQuery.aggregateField = params.aggregateField;
  }
  if (params.aggregateSort !== null) {
    locationQuery.aggregateSort = params.aggregateSort;
  }
  if (params.crossEvents !== null) {
    locationQuery.crossEvents = params.crossEvents;
  }

  const fakeLocation = {query: locationQuery} as {
    query: Record<string, string | string[] | undefined>;
  };

  // extrapolate: '1' (default) means true, '0' means false
  const extrapolate = (params.extrapolate ?? '1') === '1';

  // mode
  const mode = params.mode === Mode.AGGREGATE ? Mode.AGGREGATE : Mode.SAMPLES;

  // query
  const query = params.query;

  // cursor
  const cursor = params.cursor;

  // fields — null means use defaults
  const fields = params.field?.some(Boolean)
    ? params.field.filter(Boolean)
    : defaultFields();

  // sortBys — parse from raw sort strings, validate against fields
  const sortBys = parseSortBys(params.sort, fields) ?? defaultSortBys(fields);

  // aggregateCursor
  const aggregateCursor = params.aggregateCursor;

  // aggregateFields — reuse existing parser via fake location
  const aggregateFields = getSpansAggregateFieldsFromFakeLocation(fakeLocation);

  // aggregateSortBys — parse and validate against aggregate fields
  const aggregateSortBys =
    parseAggregateSortBys(params.aggregateSort, aggregateFields) ??
    defaultAggregateSortBys(aggregateFields);

  // id and title
  const id = params.id ?? undefined;
  const title = params.title ?? undefined;

  // crossEvents — reuse existing parser via fake location
  const crossEvents = getCrossEventsFromLocation(fakeLocation as any, 'crossEvents');

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
    return [{field: 'timestamp', kind: 'desc' as const}];
  }
  if (fields.length) {
    return [{field: fields[0]!, kind: 'desc' as const}];
  }
  return [];
}

function defaultGroupBys(): [GroupBy] {
  return [{groupBy: ''}];
}

function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
  for (const aggregateField of aggregateFields) {
    if (isVisualize(aggregateField)) {
      return [{field: aggregateField.yAxis, kind: 'desc' as const}];
    }
  }
  for (const aggregateField of aggregateFields) {
    if (isGroupBy(aggregateField)) {
      return [{field: aggregateField.groupBy, kind: 'desc' as const}];
    }
  }
  return [];
}

function parseSortBys(rawSorts: string[] | null, fields: string[]): Sort[] | null {
  if (!rawSorts || rawSorts.length === 0) {
    return null;
  }
  const sortBys = decodeSorts(rawSorts);
  if (sortBys.length > 0 && sortBys.every(sort => fields.includes(sort.field))) {
    return sortBys;
  }
  return null;
}

function parseAggregateSortBys(
  rawSorts: string[] | null,
  aggregateFields: AggregateField[]
): Sort[] | null {
  if (!rawSorts || rawSorts.length === 0) {
    return null;
  }
  const sortBys = decodeSorts(rawSorts);
  if (
    sortBys.length > 0 &&
    sortBys.every(sort => validateAggregateSort(sort, aggregateFields))
  ) {
    return sortBys;
  }
  return null;
}

function getSpansAggregateFieldsFromFakeLocation(location: {
  query: Record<string, string | string[] | undefined>;
}): AggregateField[] {
  const aggregateFields = getAggregateFieldsFromLocation(
    location as any,
    'aggregateField'
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
    if (!hasGroupBy) {
      aggregateFields.push(...defaultGroupBys());
    }
    if (!hasVisualize) {
      aggregateFields.push(...defaultVisualizes());
    }
    return aggregateFields;
  }

  const fakeLocationForLegacy = location as any;
  return [
    ...(getGroupBysFromLocation(fakeLocationForLegacy, 'groupBy') ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(fakeLocationForLegacy, 'visualize') ??
      defaultVisualizes()),
  ];
}
