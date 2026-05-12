import type {Location} from 'history';
import {
  createParser,
  createSerializer,
  parseAsNativeArrayOf,
  parseAsString,
  parseAsStringEnum,
} from 'nuqs';

import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_CURSOR_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getAggregateFieldsFromLocation} from 'sentry/views/explore/queryParams/aggregateField';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateSortBysFromLocation} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCursorFromLocation} from 'sentry/views/explore/queryParams/cursor';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import {
  defaultGroupBys,
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {getModeFromLocation} from 'sentry/views/explore/queryParams/mode';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getQueryFromLocation} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  getIdFromLocation,
  getTitleFromLocation,
  ID_KEY,
  TITLE_KEY,
} from 'sentry/views/explore/queryParams/savedQuery';
import {getSortBysFromLocation} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const LOGS_MODE_KEY = 'mode';
export const LOGS_AGGREGATE_FIELD_KEY = 'aggregateField';
const LOGS_ID_KEY = ID_KEY;
const LOGS_TITLE_KEY = TITLE_KEY;

/**
 * Custom parser for Sort values encoded as "-field" (desc) or "field" (asc).
 */
const parseAsSort = createParser({
  parse: (value: string) => decodeSorts(value).at(0) ?? null,
  serialize: (value: Sort) => encodeSort(value),
});

/**
 * nuqs parsers for all logs query params.
 * Used with useQueryStates in the provider and createSerializer for link generation.
 */
export const logsQueryParamsParsers = {
  [LOGS_MODE_KEY]: parseAsStringEnum(Object.values(Mode)),
  [LOGS_QUERY_KEY]: parseAsString,
  [LOGS_CURSOR_KEY]: parseAsString,
  [LOGS_FIELDS_KEY]: parseAsNativeArrayOf(parseAsString),
  [LOGS_SORT_BYS_KEY]: parseAsNativeArrayOf(parseAsSort),
  [LOGS_AGGREGATE_CURSOR_KEY]: parseAsString,
  [LOGS_AGGREGATE_FIELD_KEY]: parseAsNativeArrayOf(parseAsString),
  [LOGS_AGGREGATE_SORT_BYS_KEY]: parseAsNativeArrayOf(parseAsSort),
  [LOGS_ID_KEY]: parseAsString,
  [LOGS_TITLE_KEY]: parseAsString,
};

const serialize = createSerializer(logsQueryParamsParsers);

/**
 * Build a Location target with updated query params from WritableQueryParams.
 * Uses nuqs serializers for consistent encoding.
 */
export function buildLogsTarget(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  // Build the values to serialize. nuqs serializer handles null (delete) vs undefined (skip).
  const valuesToSerialize: Record<string, any> = {};

  if (writableQueryParams.mode !== undefined) {
    valuesToSerialize[LOGS_MODE_KEY] = writableQueryParams.mode;
  }
  if (writableQueryParams.query !== undefined) {
    valuesToSerialize[LOGS_QUERY_KEY] = writableQueryParams.query;
  }
  if (writableQueryParams.cursor !== undefined) {
    valuesToSerialize[LOGS_CURSOR_KEY] = writableQueryParams.cursor;
  }
  if (writableQueryParams.fields !== undefined) {
    valuesToSerialize[LOGS_FIELDS_KEY] =
      writableQueryParams.fields === null
        ? null
        : writableQueryParams.fields?.filter(Boolean);
  }
  if (writableQueryParams.sortBys !== undefined) {
    valuesToSerialize[LOGS_SORT_BYS_KEY] =
      writableQueryParams.sortBys === null ? null : writableQueryParams.sortBys?.slice();
  }
  if (writableQueryParams.aggregateCursor !== undefined) {
    valuesToSerialize[LOGS_AGGREGATE_CURSOR_KEY] = writableQueryParams.aggregateCursor;
  }
  if (writableQueryParams.aggregateFields !== undefined) {
    valuesToSerialize[LOGS_AGGREGATE_FIELD_KEY] =
      writableQueryParams.aggregateFields === null
        ? null
        : writableQueryParams.aggregateFields?.map(aggregateField =>
            JSON.stringify(aggregateField)
          );
  }
  if (writableQueryParams.aggregateSortBys !== undefined) {
    valuesToSerialize[LOGS_AGGREGATE_SORT_BYS_KEY] =
      writableQueryParams.aggregateSortBys === null
        ? null
        : writableQueryParams.aggregateSortBys?.slice();
  }

  // Use nuqs serializer to produce the query string, merging with existing params
  const existingSearch = new URLSearchParams();
  for (const [key, val] of Object.entries(target.query)) {
    if (Array.isArray(val)) {
      for (const v of val) {
        existingSearch.append(key, v);
      }
    } else if (val !== null && val !== undefined) {
      existingSearch.set(key, val);
    }
  }

  const serialized = serialize(existingSearch, valuesToSerialize);
  const newSearch = new URLSearchParams(serialized);

  // when using aggregate fields, we want to make sure to delete the params
  // used by the separate group by, aggregate fn and aggregate param
  if (defined(writableQueryParams.aggregateFields)) {
    newSearch.delete(LOGS_GROUP_BY_KEY);
    newSearch.delete(LOGS_AGGREGATE_FN_KEY);
    newSearch.delete(LOGS_AGGREGATE_PARAM_KEY);
  }

  // Convert URLSearchParams back to the query object format
  const newQuery: Record<string, string | string[]> = {};
  for (const key of newSearch.keys()) {
    const values = newSearch.getAll(key);
    newQuery[key] = values.length === 1 ? values[0]! : values;
  }

  target.query = newQuery;
  return target;
}

export function isDefaultFields(location: Location): boolean {
  return getFieldsFromLocation(location, LOGS_FIELDS_KEY) ? false : true;
}

export function getReadableQueryParamsFromLocation(
  defaultVisible: boolean,
  location: Location
): ReadableQueryParams {
  const mode = getModeFromLocation(location, LOGS_MODE_KEY);
  const query = getQueryFromLocation(location, LOGS_QUERY_KEY) ?? '';

  const cursor = getCursorFromLocation(location, LOGS_CURSOR_KEY);
  const fields = getFieldsFromLocation(location, LOGS_FIELDS_KEY) ?? defaultLogFields();
  const sortBys =
    getSortBysFromLocation(location, LOGS_SORT_BYS_KEY, fields) ?? defaultSortBys(fields);

  const aggregateCursor = getCursorFromLocation(location, LOGS_AGGREGATE_CURSOR_KEY);
  const aggregateFields = getLogsAggregateFieldsFromLocation(defaultVisible, location);
  const aggregateSortBys =
    getAggregateSortBysFromLocation(
      location,
      LOGS_AGGREGATE_SORT_BYS_KEY,
      aggregateFields
    ) ?? defaultAggregateSortBys(aggregateFields);

  const id = getIdFromLocation(location, LOGS_ID_KEY);
  const title = getTitleFromLocation(location, LOGS_TITLE_KEY);

  return new ReadableQueryParams({
    extrapolate: true,
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
  });
}

function defaultSortBys(fields: string[]) {
  if (fields.includes(OurLogKnownFieldKey.TIMESTAMP)) {
    return [
      {
        field: OurLogKnownFieldKey.TIMESTAMP,
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

export function defaultVisualizes(defaultVisible: boolean) {
  return [
    new VisualizeFunction(`${AggregationKey.COUNT}(${OurLogKnownFieldKey.MESSAGE})`, {
      visible: defaultVisible,
    }),
  ];
}

function getVisualizesFromLocation(location: Location): Visualize[] | null {
  const aggregateFn = decodeScalar(location.query?.[LOGS_AGGREGATE_FN_KEY]);

  if (aggregateFn === AggregationKey.COUNT) {
    return [new VisualizeFunction(`${aggregateFn}(${OurLogKnownFieldKey.MESSAGE})`)];
  }

  const aggregateParam = decodeScalar(location.query?.[LOGS_AGGREGATE_PARAM_KEY]);

  if (!aggregateParam) {
    return null;
  }

  return [new VisualizeFunction(`${aggregateFn}(${aggregateParam})`)];
}

function getLogsAggregateFieldsFromLocation(
  defaultVisible: boolean,
  location: Location
): AggregateField[] {
  const aggregateFields = getAggregateFieldsFromLocation(
    location,
    LOGS_AGGREGATE_FIELD_KEY
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
      aggregateFields.push(...defaultVisualizes(defaultVisible));
    }

    return aggregateFields;
  }

  // TODO: support a list of aggregate fields,
  // needed for re-ordering columns in aggregate mode
  return [
    ...(getGroupBysFromLocation(location, LOGS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(location) ?? defaultVisualizes(defaultVisible)),
  ];
}

export function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
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
