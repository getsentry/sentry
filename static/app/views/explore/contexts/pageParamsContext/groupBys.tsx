import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export const UNGROUPED = '';

export function defaultGroupBys(): string[] {
  return ['span.op'];
}

export function getGroupBysFromLocation(location: Location): string[] {
  // We do not support grouping by span id, we have a dedicated sample mode for that
  const filteredGroupBys = decodeList(location.query.groupBy).filter(
    groupBy => groupBy !== 'id'
  );

  if (filteredGroupBys.length) {
    return filteredGroupBys;
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
  } else if (groupBys === null) {
    delete location.query.groupBy;
  }
}
