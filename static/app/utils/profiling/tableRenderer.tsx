import {LocationDescriptorObject} from 'history';

import {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';

type Sort<K> = {
  column: K;
  direction: 'asc' | 'desc';
};

interface TableHeadProps<K> {
  currentSort?: Sort<K>;
  generateSortLink?: (column: K) => () => LocationDescriptorObject | undefined;
  rightAlignedColumns?: Set<K>;
  sortableColumns?: Set<K>;
}

export function renderTableHead<K>({
  currentSort,
  generateSortLink,
  rightAlignedColumns,
  sortableColumns,
}: TableHeadProps<K>) {
  return (column: GridColumnOrder<K>, _columnIndex: number) => {
    return (
      <SortLink
        align={rightAlignedColumns?.has(column.key) ? 'right' : 'left'}
        title={column.name}
        direction={
          currentSort?.column === column.key ? currentSort?.direction : undefined
        }
        canSort={sortableColumns?.has(column.key) || false}
        generateSortLink={generateSortLink?.(column.key) ?? (() => undefined)}
      />
    );
  };
}
