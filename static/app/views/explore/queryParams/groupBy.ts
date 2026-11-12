import {defined} from 'sentry/utils/defined';

export interface GroupBy {
  groupBy: string;
}

export function defaultGroupBys() {
  return [{groupBy: ''}];
}

export function getGroupBys(rawGroupBys: readonly string[]): GroupBy[] | null {
  if (rawGroupBys.length) {
    return rawGroupBys.map(groupBy => ({groupBy}));
  }

  return null;
}

export function isGroupBy(value: any): value is GroupBy {
  return defined(value) && typeof value === 'object' && typeof value.groupBy === 'string';
}
