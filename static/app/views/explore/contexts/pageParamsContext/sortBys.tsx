import type {Sort} from 'sentry/utils/discover/fields';
import {getAggregateAlias} from 'sentry/utils/discover/fields';

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

export function formatSort(sort: Sort): string {
  // The event view still expects the alias in the sort
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${getAggregateAlias(sort.field)}`;
}
