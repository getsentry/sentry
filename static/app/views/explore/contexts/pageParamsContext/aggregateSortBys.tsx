import type {Sort} from 'sentry/utils/discover/fields';

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
