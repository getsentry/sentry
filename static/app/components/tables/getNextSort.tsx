import type {SortDirection} from 'sentry/components/tables/sortableHeaderCell';
import type {Sort} from 'sentry/utils/discover/fields';

/**
 * The direction a column takes when it is clicked: the opposite of the one it
 * currently holds, or `defaultDirection` when it is not the sorted column.
 */
export function getNextDirection(
  currentDirection: SortDirection | undefined,
  defaultDirection: SortDirection = 'desc'
): SortDirection {
  if (!currentDirection) {
    return defaultDirection;
  }

  return currentDirection === 'asc' ? 'desc' : 'asc';
}

export function getNextSort(
  field: string,
  currentSort: Sort | undefined,
  defaultDirection: SortDirection = 'desc'
): Sort {
  return {
    field,
    kind: getNextDirection(
      currentSort?.field === field ? currentSort.kind : undefined,
      defaultDirection
    ),
  };
}
