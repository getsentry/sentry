import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';

export interface GroupBy {
  groupBy: string;
}

export function defaultGroupBys() {
  return [{groupBy: ''}];
}

export function getGroupBysFromLocation(
  location: Location,
  key: string
): GroupBy[] | null {
  const rawGroupBys = decodeList(location.query?.[key]);

  if (rawGroupBys.length) {
    return rawGroupBys.map(groupBy => ({groupBy}));
  }

  return null;
}

export function isGroupBy(value: any): value is GroupBy {
  return defined(value) && typeof value === 'object' && typeof value.groupBy === 'string';
}
