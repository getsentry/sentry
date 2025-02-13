import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export const UNGROUPED = '';

export function defaultGroupBys(): string[] {
  return ['span.op'];
}

export function getGroupBysFromLocation(location: Location): string[] {
  const rawGroupBys = decodeList(location.query.groupBy);

  if (rawGroupBys.length) {
    return rawGroupBys;
  }

  // If the param is defined by has empty string for value
  // we're still getting back the empty list. This special
  // cases it and ensures we permit the empty group by.
  if (defined(location.query.groupBy)) {
    return [''];
  }

  return defaultGroupBys();
}

export function updateLocationWithGroupBys(
  location: Location,
  groupBys: string[] | null | undefined
) {
  if (defined(groupBys)) {
    location.query.groupBy = groupBys;

    // make sure to clear the cursor every time the query is updated
    delete location.query.cursor;
  } else if (groupBys === null) {
    delete location.query.groupBy;
  }
}
