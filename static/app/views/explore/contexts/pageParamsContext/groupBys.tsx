import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export const UNGROUPED = '';

export function defaultGroupBys(): string[] {
  return [''];
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
