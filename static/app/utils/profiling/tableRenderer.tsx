import type {LocationDescriptor} from 'history';

import type {
  GridColumnOrder,
  GridColumnSort,
  GridColumnSortBy,
} from 'sentry/components/tables/gridEditable';

interface ColumnSortProps<K> {
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
}: ColumnSortProps<K>) {
  return function (column: GridColumnOrder<K>): GridColumnSort {
    const align = rightAlignedColumns?.has(column.key) ? 'right' : 'left';

    if (!sortableColumns?.has(column.key)) {
      return {align};
    }

    return {
      align,
      direction: currentSort?.key === column.key ? currentSort.order : undefined,
      replace: true,
      to: generateSortLink?.(column.key)(),
    };
  };
}
