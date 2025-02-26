import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

const LOGS_SORT_BYS_KEY = 'logsSortBys';
function defaultLogSortBys(fields: string[]): Sort[] {
  if (fields.includes('timestamp')) {
    return [
      {
        field: 'timestamp',
        kind: 'desc' as const,
      },
    ];
  }

  return [];
}

export function getLogSortBysFromLocation(location: Location, fields: string[]): Sort[] {
  const sortBys = decodeSorts(location.query[LOGS_SORT_BYS_KEY]);

  if (sortBys.length > 0) {
    return sortBys;
  }

  return defaultLogSortBys(fields);
}

export function updateLocationWithLogSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined,
  cursorUrlParam: string
) {
  if (defined(sortBys)) {
    location.query[LOGS_SORT_BYS_KEY] = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query[cursorUrlParam];
  } else if (sortBys === null) {
    delete location.query[LOGS_SORT_BYS_KEY];
  }
}
