import type {Location} from 'history';
import {parseAsString, type inferParserType} from 'nuqs';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
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
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {
  getAggregateFieldsFromLocation,
  normalizeAggregateFields,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  getAggregateSortBysFromLocation,
  getValidAggregateSortBys,
} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {
  defaultCursor,
  getCursorFromLocation,
} from 'sentry/views/explore/queryParams/cursor';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import {
  defaultGroupBys,
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {defaultMode, getModeFromLocation} from 'sentry/views/explore/queryParams/mode';
import {
  parseAsAggregateFields,
  parseAsFields,
  parseAsGroupBys,
  parseAsMode,
  parseAsSortBys,
  serializeQueryParamsToLocation,
} from 'sentry/views/explore/queryParams/nuqsParsers';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ID_KEY, TITLE_KEY} from 'sentry/views/explore/queryParams/savedQuery';
import {
  getSortBysFromLocation,
  getValidSortBys,
} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const LOGS_MODE_KEY = 'mode';
export const LOGS_AGGREGATE_FIELD_KEY = 'aggregateField';
const LOGS_ID_KEY = ID_KEY;
const LOGS_TITLE_KEY = TITLE_KEY;

export const logsQueryParamsParsers = {
  [LOGS_MODE_KEY]: parseAsMode,
  [LOGS_QUERY_KEY]: parseAsString,
  [LOGS_CURSOR_KEY]: parseAsString,
  [LOGS_FIELDS_KEY]: parseAsFields,
  [LOGS_SORT_BYS_KEY]: parseAsSortBys,
  [LOGS_AGGREGATE_CURSOR_KEY]: parseAsString,
  [LOGS_AGGREGATE_FIELD_KEY]: parseAsAggregateFields,
  [LOGS_AGGREGATE_SORT_BYS_KEY]: parseAsSortBys,
  [LOGS_GROUP_BY_KEY]: parseAsGroupBys,
  [LOGS_AGGREGATE_FN_KEY]: parseAsString,
  [LOGS_AGGREGATE_PARAM_KEY]: parseAsString,
  [LOGS_ID_KEY]: parseAsString,
  [LOGS_TITLE_KEY]: parseAsString,
};

type LogsQueryParams = inferParserType<typeof logsQueryParamsParsers>;

/** @public used by logsQueryParams.spec.tsx to cover legacy location parsing */
export function getReadableQueryParamsFromLocation(
  defaultVisible: boolean,
  location: Location
): ReadableQueryParams {
  const mode = getModeFromLocation(location, LOGS_MODE_KEY);
  const query = decodeScalar(location.query[LOGS_QUERY_KEY]) ?? '';

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

  const id = decodeScalar(location.query[LOGS_ID_KEY]);
  const title = decodeScalar(location.query[LOGS_TITLE_KEY]);

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

export function getReadableQueryParamsFromParsed(
  defaultVisible: boolean,
  queryParams: LogsQueryParams
): ReadableQueryParams {
  const mode = queryParams[LOGS_MODE_KEY] ?? defaultMode();
  const query = queryParams[LOGS_QUERY_KEY] ?? '';

  const cursor = queryParams[LOGS_CURSOR_KEY] ?? defaultCursor();
  const fields = queryParams[LOGS_FIELDS_KEY] ?? defaultLogFields();
  const sortBys =
    getValidSortBys(queryParams[LOGS_SORT_BYS_KEY], fields) ?? defaultSortBys(fields);

  const aggregateCursor = queryParams[LOGS_AGGREGATE_CURSOR_KEY] ?? defaultCursor();
  const aggregateFields = getLogsAggregateFieldsFromParsed(defaultVisible, queryParams);
  const aggregateSortBys =
    getValidAggregateSortBys(queryParams[LOGS_AGGREGATE_SORT_BYS_KEY], aggregateFields) ??
    defaultAggregateSortBys(aggregateFields);

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

    id: queryParams[LOGS_ID_KEY] ?? undefined,
    title: queryParams[LOGS_TITLE_KEY] ?? undefined,
  });
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  return serializeQueryParamsToLocation(
    location,
    logsQueryParamsParsers,
    getLogsQueryParamsUpdate(writableQueryParams)
  );
}

export function getLogsQueryParamsUpdate(writableQueryParams: WritableQueryParams) {
  const update: Partial<Record<keyof typeof logsQueryParamsParsers, any>> = {};

  if (defined(writableQueryParams.mode) || writableQueryParams.mode === null) {
    update[LOGS_MODE_KEY] = writableQueryParams.mode;
  }
  if (defined(writableQueryParams.query) || writableQueryParams.query === null) {
    update[LOGS_QUERY_KEY] = writableQueryParams.query;
  }
  if (defined(writableQueryParams.cursor) || writableQueryParams.cursor === null) {
    update[LOGS_CURSOR_KEY] = writableQueryParams.cursor;
  }
  if (Object.hasOwn(writableQueryParams, 'aggregateCursor')) {
    update[LOGS_AGGREGATE_CURSOR_KEY] = writableQueryParams.aggregateCursor ?? null;
  }
  if (defined(writableQueryParams.fields) || writableQueryParams.fields === null) {
    update[LOGS_FIELDS_KEY] =
      writableQueryParams.fields === null
        ? null
        : writableQueryParams.fields.filter(Boolean);
  }
  if (defined(writableQueryParams.sortBys) || writableQueryParams.sortBys === null) {
    update[LOGS_SORT_BYS_KEY] = writableQueryParams.sortBys;
  }
  if (
    defined(writableQueryParams.aggregateFields) ||
    writableQueryParams.aggregateFields === null
  ) {
    update[LOGS_AGGREGATE_FIELD_KEY] = writableQueryParams.aggregateFields;
    update[LOGS_GROUP_BY_KEY] = null;
    update[LOGS_AGGREGATE_FN_KEY] = null;
    update[LOGS_AGGREGATE_PARAM_KEY] = null;
  }
  if (
    defined(writableQueryParams.aggregateSortBys) ||
    writableQueryParams.aggregateSortBys === null
  ) {
    update[LOGS_AGGREGATE_SORT_BYS_KEY] = writableQueryParams.aggregateSortBys;
  }

  return update;
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

function getVisualizesFromParsed(queryParams: LogsQueryParams): Visualize[] | null {
  const aggregateFn = queryParams[LOGS_AGGREGATE_FN_KEY];

  if (aggregateFn === AggregationKey.COUNT) {
    return [new VisualizeFunction(`${aggregateFn}(${OurLogKnownFieldKey.MESSAGE})`)];
  }

  const aggregateParam = queryParams[LOGS_AGGREGATE_PARAM_KEY];

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

function getLogsAggregateFieldsFromParsed(
  defaultVisible: boolean,
  queryParams: LogsQueryParams
): AggregateField[] {
  const aggregateFields = queryParams[LOGS_AGGREGATE_FIELD_KEY];

  if (aggregateFields?.length) {
    return withRequiredAggregateFields(
      normalizeAggregateFields(aggregateFields),
      defaultVisible
    );
  }

  return [
    ...(queryParams[LOGS_GROUP_BY_KEY] ?? defaultGroupBys()),
    ...(getVisualizesFromParsed(queryParams) ?? defaultVisualizes(defaultVisible)),
  ];
}

function withRequiredAggregateFields(
  aggregateFields: AggregateField[],
  defaultVisible: boolean
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
    aggregateFields.push(...defaultVisualizes(defaultVisible));
  }

  return aggregateFields;
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
