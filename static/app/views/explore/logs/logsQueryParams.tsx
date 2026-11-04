import type {Location} from 'history';
import type {inferParserType} from 'nuqs';

import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {LOGS_CURSOR_KEY} from 'sentry/views/explore/contexts/logs/constants';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getAggregateFields} from 'sentry/views/explore/queryParams/aggregateField';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateSortBys} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {getFields} from 'sentry/views/explore/queryParams/field';
import {
  defaultGroupBys,
  getGroupBys,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {defaultMode} from 'sentry/views/explore/queryParams/mode';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
  parseAsFieldList,
  parseAsMode,
  parseAsRawList,
  parseAsScalar,
  type QueryParamsUpdates,
} from 'sentry/views/explore/queryParams/parsers';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ID_KEY, TITLE_KEY} from 'sentry/views/explore/queryParams/savedQuery';
import {getSortBys} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const LOGS_MODE_KEY = 'mode';
export const LOGS_AGGREGATE_FIELD_KEY = 'aggregateField';
const LOGS_ID_KEY = ID_KEY;
const LOGS_TITLE_KEY = TITLE_KEY;

export const LOGS_QUERY_PARSERS = {
  [LOGS_MODE_KEY]: parseAsMode,
  [LOGS_QUERY_KEY]: parseAsScalar,
  [LOGS_CURSOR_KEY]: parseAsScalar,
  [LOGS_FIELDS_KEY]: parseAsFieldList,
  [LOGS_SORT_BYS_KEY]: parseAsRawList,
  [LOGS_AGGREGATE_CURSOR_KEY]: parseAsScalar,
  [LOGS_AGGREGATE_FIELD_KEY]: parseAsRawList,
  [LOGS_AGGREGATE_SORT_BYS_KEY]: parseAsRawList,
  [LOGS_GROUP_BY_KEY]: parseAsRawList,
  [LOGS_AGGREGATE_FN_KEY]: parseAsScalar,
  [LOGS_AGGREGATE_PARAM_KEY]: parseAsScalar,
  [LOGS_ID_KEY]: parseAsScalar,
  [LOGS_TITLE_KEY]: parseAsScalar,
};

type LogsQueryValues = inferParserType<typeof LOGS_QUERY_PARSERS>;

export function isDefaultLogsFields(values: LogsQueryValues): boolean {
  return getFields(values[LOGS_FIELDS_KEY]) === null;
}

export function getReadableLogsQueryParams(values: LogsQueryValues): ReadableQueryParams {
  const mode = values[LOGS_MODE_KEY] ?? defaultMode();
  const query = values[LOGS_QUERY_KEY] ?? '';

  const cursor = values[LOGS_CURSOR_KEY] ?? defaultCursor();
  const fields = getFields(values[LOGS_FIELDS_KEY]) ?? defaultLogFields();
  const sortBys = getSortBys(values[LOGS_SORT_BYS_KEY], fields) ?? defaultSortBys(fields);

  const aggregateCursor = values[LOGS_AGGREGATE_CURSOR_KEY] ?? defaultCursor();
  const aggregateFields = getLogsAggregateFields(values);
  const aggregateSortBys =
    getAggregateSortBys(values[LOGS_AGGREGATE_SORT_BYS_KEY], aggregateFields) ??
    defaultAggregateSortBys(aggregateFields);

  const id = values[LOGS_ID_KEY] ?? undefined;
  const title = values[LOGS_TITLE_KEY] ?? undefined;

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

/** @internal used in tests */
export function getReadableQueryParamsFromLocation(
  location: Location
): ReadableQueryParams {
  return getReadableLogsQueryParams(
    loadQueryParamsFromLocation(LOGS_QUERY_PARSERS, location)
  );
}

function encodeSorts(sortBys: readonly Sort[]): string[] {
  return sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`);
}

export function getLogsQueryParamsUpdates(
  writableQueryParams: WritableQueryParams
): QueryParamsUpdates<typeof LOGS_QUERY_PARSERS> {
  const {aggregateFields} = writableQueryParams;
  // Aggregate fields replace the older separate group by, aggregate function,
  // and aggregate param keys.
  const legacyAggregateUpdate = defined(aggregateFields) ? null : undefined;

  return {
    [LOGS_MODE_KEY]: writableQueryParams.mode,
    [LOGS_QUERY_KEY]: writableQueryParams.query,
    [LOGS_CURSOR_KEY]: writableQueryParams.cursor,
    [LOGS_FIELDS_KEY]:
      writableQueryParams.fields === null
        ? null
        : writableQueryParams.fields?.filter(Boolean),
    [LOGS_SORT_BYS_KEY]:
      writableQueryParams.sortBys === null
        ? null
        : writableQueryParams.sortBys && encodeSorts(writableQueryParams.sortBys),
    [LOGS_AGGREGATE_CURSOR_KEY]: writableQueryParams.aggregateCursor,
    [LOGS_AGGREGATE_FIELD_KEY]: aggregateFields?.map(aggregateField =>
      JSON.stringify(aggregateField)
    ),
    [LOGS_AGGREGATE_SORT_BYS_KEY]:
      writableQueryParams.aggregateSortBys === null
        ? null
        : writableQueryParams.aggregateSortBys &&
          encodeSorts(writableQueryParams.aggregateSortBys),
    [LOGS_GROUP_BY_KEY]: legacyAggregateUpdate,
    [LOGS_AGGREGATE_FN_KEY]: legacyAggregateUpdate,
    [LOGS_AGGREGATE_PARAM_KEY]: legacyAggregateUpdate,
  };
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  return applyQueryParamsUpdates(
    LOGS_QUERY_PARSERS,
    location,
    getLogsQueryParamsUpdates(writableQueryParams)
  );
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

export function defaultVisualizes() {
  return [
    new VisualizeFunction(`${AggregationKey.COUNT}(${OurLogKnownFieldKey.MESSAGE})`),
  ];
}

function getLegacyVisualizes(values: LogsQueryValues): Visualize[] | null {
  const aggregateFn = values[LOGS_AGGREGATE_FN_KEY] ?? undefined;

  if (aggregateFn === AggregationKey.COUNT) {
    return [new VisualizeFunction(`${aggregateFn}(${OurLogKnownFieldKey.MESSAGE})`)];
  }

  const aggregateParam = values[LOGS_AGGREGATE_PARAM_KEY];

  if (!aggregateParam) {
    return null;
  }

  return [new VisualizeFunction(`${aggregateFn}(${aggregateParam})`)];
}

function getLogsAggregateFields(values: LogsQueryValues): AggregateField[] {
  const aggregateFields = getAggregateFields(values[LOGS_AGGREGATE_FIELD_KEY]);

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

  // TODO: support a list of aggregate fields,
  // needed for re-ordering columns in aggregate mode
  return [
    ...(getGroupBys(values[LOGS_GROUP_BY_KEY]) ?? defaultGroupBys()),
    ...(getLegacyVisualizes(values) ?? defaultVisualizes()),
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
