import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export const UNGROUPED = '';

export function defaultGroupBys(): string[] {
  return [UNGROUPED];
}

export function getGroupBysFromLocation(location: Location): string[] {
  const rawGroupBys = decodeList(location.query.groupBy);

  if (rawGroupBys.length) {
    return rawGroupBys;
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
