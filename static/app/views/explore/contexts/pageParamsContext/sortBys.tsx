import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

export function defaultSortBys(fields: string[]): Sort[] {
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

export function getSortBysFromLocation(location: Location, fields: string[]): Sort[] {
  const sortBys = decodeSorts(location.query.sort);

  if (sortBys.length > 0) {
    if (sortBys.every(sortBy => fields.includes(sortBy.field))) {
      return sortBys;
    }
  }

  return defaultSortBys(fields);
}

export function updateLocationWithSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined
) {
  if (defined(sortBys)) {
    location.query.sort = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query.cursor;
  } else if (sortBys === null) {
    delete location.query.sort;
  }
}

export function formatSort(sort: Sort): string {
  // The event view still expects the alias in the sort
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${getAggregateAlias(sort.field)}`;
}
