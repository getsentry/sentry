import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_CURSOR_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LOGS_SORT_BYS_KEY = 'logsSortBys';
export const LOGS_AGGREGATE_SORT_BYS_KEY = 'logsAggregateSortBys';

export const logsTimestampDescendingSortBy: Sort = {
  field: OurLogKnownFieldKey.TIMESTAMP,
  kind: 'desc' as const,
};

export function getLogSortBysFromLocation(location: Location, fields: string[]): Sort[] {
  const sortBys = decodeSorts(location.query[LOGS_SORT_BYS_KEY]);

  if (sortBys.length > 0) {
    if (sortBys.every(sortBy => fields.includes(sortBy.field))) {
      return sortBys;
    }
  }

  if (fields.includes(OurLogKnownFieldKey.TIMESTAMP)) {
    return [logsTimestampDescendingSortBy];
  }

  if (!fields[0]) {
    throw new Error(
      'fields should not be empty - did you somehow delete all of the fields?'
    );
  }

  return [
    {
      field: fields[0],
      kind: 'desc' as const,
    },
  ];
}

export function getLogAggregateSortBysFromLocation(
  location: Location,
  fields: string[]
): Sort[] {
  const sortBys = decodeSorts(location.query[LOGS_AGGREGATE_SORT_BYS_KEY]);

  if (sortBys.length > 0) {
    if (sortBys.every(sortBy => fields.includes(sortBy.field))) {
      return sortBys;
    }
  }

  if (!fields.length) {
    throw new Error(
      'fields should not be empty - did you somehow delete all of the fields?'
    );
  }

  return [
    {
      field: fields[fields.length - 1]!,
      kind: 'desc' as const,
    },
  ];
}

export function updateLocationWithLogSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined
) {
  if (defined(sortBys)) {
    location.query[LOGS_SORT_BYS_KEY] = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query[LOGS_CURSOR_KEY];
  } else if (sortBys === null) {
    delete location.query[LOGS_SORT_BYS_KEY];
  }
}

export function updateLocationWithAggregateSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined
) {
  if (defined(sortBys)) {
    location.query[LOGS_AGGREGATE_SORT_BYS_KEY] = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query[LOGS_AGGREGATE_CURSOR_KEY];
  } else if (sortBys === null) {
    delete location.query[LOGS_AGGREGATE_SORT_BYS_KEY];
  }
}
