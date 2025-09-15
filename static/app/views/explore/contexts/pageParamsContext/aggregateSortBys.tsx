import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';

import type {Visualize} from './visualizes';

export function defaultAggregateSortBys(yAxes: string[]): Sort[] {
  if (yAxes[0]) {
    return [
      {
        field: yAxes[0],
        kind: 'desc' as const,
      },
    ];
  }

  return [];
}

export function getAggregateSortBysFromLocation(
  location: Location,
  groupBys: string[],
  visualizes: Visualize[]
) {
  const sortBys = decodeSorts(location.query.aggregateSort);

  if (sortBys.length > 0 && validateSorts(sortBys, groupBys, visualizes)) {
    return sortBys;
  }

  // we want to check the `sort` query param for backwards compatibility
  // when the both modes shared a single query param for the sort
  const sortBysFallback = decodeSorts(location.query.sort);

  if (
    sortBysFallback.length > 0 &&
    validateSorts(sortBysFallback, groupBys, visualizes)
  ) {
    return sortBysFallback;
  }

  return defaultAggregateSortBys(visualizes.map(visualize => visualize.yAxis));
}

function validateSorts(
  sortBys: Sort[],
  groupBys: string[],
  visualizes: Visualize[]
): boolean {
  return sortBys.every(
    sortBy =>
      groupBys.includes(sortBy.field) ||
      visualizes.some(visualize => visualize.yAxis === sortBy.field)
  );
}

export function updateLocationWithAggregateSortBys(
  location: Location,
  sortBys: Sort[] | null | undefined
) {
  if (defined(sortBys)) {
    location.query.aggregateSort = sortBys.map(sortBy =>
      sortBy.kind === 'desc' ? `-${sortBy.field}` : sortBy.field
    );

    // make sure to clear the cursor every time the query is updated
    delete location.query.cursor;
  } else if (sortBys === null) {
    delete location.query.aggregateSort;
  }
}
