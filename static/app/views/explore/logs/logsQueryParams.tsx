import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
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
import {getAggregateSortBysFromLocation} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCursorFromLocation} from 'sentry/views/explore/queryParams/cursor';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import {
  defaultGroupBys,
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {getModeFromLocation} from 'sentry/views/explore/queryParams/mode';
import {getQueryFromLocation} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {getSortBysFromLocation} from 'sentry/views/explore/queryParams/sortBy';
import {isVisualize, Visualize} from 'sentry/views/explore/queryParams/visualize';

const LOGS_MODE_KEY = 'mode';

export function getReadableQueryParamsFromLocation(
  location: Location
): ReadableQueryParams {
  const mode = getModeFromLocation(location, LOGS_MODE_KEY);
  const query = getQueryFromLocation(location, LOGS_QUERY_KEY) ?? '';

  const cursor = getCursorFromLocation(location, LOGS_CURSOR_KEY);
  const fields = getFieldsFromLocation(location, LOGS_FIELDS_KEY) ?? defaultLogFields();
  const sortBys =
    getSortBysFromLocation(location, LOGS_SORT_BYS_KEY, fields) ?? defaultSortBys(fields);

  const aggregateCursor = getCursorFromLocation(location, LOGS_AGGREGATE_CURSOR_KEY);
  const aggregateFields = getLogsAggregateFieldsFromLocation(location);
  const aggregateSortBys =
    getAggregateSortBysFromLocation(
      location,
      LOGS_AGGREGATE_SORT_BYS_KEY,
      aggregateFields
    ) ?? defaultAggregateSortBys(aggregateFields);

  return new ReadableQueryParams({
    mode,
    query,

    cursor,
    fields,
    sortBys,

    aggregateCursor,
    aggregateFields,
    aggregateSortBys,
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

export function defaultVisualizes() {
  return [new Visualize('count(message)')];
}

function getVisualizesFromLocation(location: Location): [Visualize] {
  const aggregateFn = decodeScalar(location.query?.[LOGS_AGGREGATE_FN_KEY], 'count');
  const aggregateParam = decodeScalar(
    location.query?.[LOGS_AGGREGATE_PARAM_KEY],
    'message'
  );

  return [new Visualize(`${aggregateFn}(${aggregateParam})`)];
}

function getLogsAggregateFieldsFromLocation(location: Location): AggregateField[] {
  // TODO: support a list of aggregate fields,
  // needed for re-ordering columns in aggregate mode
  return [
    ...(getGroupBysFromLocation(location, LOGS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...getVisualizesFromLocation(location),
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
