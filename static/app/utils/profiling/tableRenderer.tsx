import type {LocationDescriptor} from 'history';

import type {
  GridColumnOrder,
  GridColumnSort,
  GridColumnSortBy,
} from 'sentry/components/tables/gridEditable';

interface TableHeadProps<K> {
  currentSort?: GridColumnSortBy<K> | null;
  generateSortLink?: (column: K) => () => LocationDescriptor | undefined;
  rightAlignedColumns?: Set<K>;
  sortableColumns?: Set<K>;
}

export function getTableColumnSort<K>({
  currentSort,
  generateSortLink,
  rightAlignedColumns,
  sortableColumns,
}: TableHeadProps<K>) {
  return function (column: GridColumnOrder<K>): GridColumnSort {
    const canSort = sortableColumns?.has(column.key) ?? false;

    return {
      align: rightAlignedColumns?.has(column.key) ? 'right' : 'left',
      direction:
        canSort && currentSort?.key === column.key ? currentSort?.order : undefined,
      replace: true,
      to: canSort ? generateSortLink?.(column.key)() : undefined,
    };
  };
}
