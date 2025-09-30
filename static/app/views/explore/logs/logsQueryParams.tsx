import type {Location} from 'history';

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
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
import {getModeFromLocation} from 'sentry/views/explore/queryParams/mode';
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

export function isDefaultFields(location: Location): boolean {
  return getFieldsFromLocation(location, LOGS_FIELDS_KEY) ? false : true;
}

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

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  updateNullableLocation(target, LOGS_MODE_KEY, writableQueryParams.mode);
  updateNullableLocation(target, LOGS_QUERY_KEY, writableQueryParams.query);

  updateNullableLocation(target, LOGS_CURSOR_KEY, writableQueryParams.cursor);
  updateNullableLocation(target, LOGS_FIELDS_KEY, writableQueryParams.fields);
  updateNullableLocation(
    target,
    LOGS_SORT_BYS_KEY,
    writableQueryParams.sortBys === null
      ? null
      : writableQueryParams.sortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  updateNullableLocation(
    target,
    LOGS_AGGREGATE_CURSOR_KEY,
    writableQueryParams.aggregateCursor
  );
  updateNullableLocation(
    target,
    LOGS_AGGREGATE_FIELD_KEY,
    writableQueryParams.aggregateFields?.map(aggregateField =>
      JSON.stringify(aggregateField)
    )
  );
  updateNullableLocation(
    target,
    LOGS_AGGREGATE_SORT_BYS_KEY,
    writableQueryParams.aggregateSortBys === null
      ? null
      : writableQueryParams.aggregateSortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  // when using aggregate fields, we want to make sure to delete the params
  // used by the separate group by, aggregate fn and aggregate param
  if (defined(writableQueryParams.aggregateFields)) {
    delete target.query[LOGS_GROUP_BY_KEY];
    delete target.query[LOGS_AGGREGATE_FN_KEY];
    delete target.query[LOGS_AGGREGATE_PARAM_KEY];
  }

  return target;
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

function getLogsAggregateFieldsFromLocation(location: Location): AggregateField[] {
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
      aggregateFields.push(...defaultVisualizes());
    }

    return aggregateFields;
  }

  // TODO: support a list of aggregate fields,
  // needed for re-ordering columns in aggregate mode
  return [
    ...(getGroupBysFromLocation(location, LOGS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(location) ?? defaultVisualizes()),
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
