import type {Sort} from 'sentry/utils/discover/fieldsBase';

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
