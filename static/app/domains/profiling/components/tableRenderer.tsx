import {LocationDescriptorObject} from 'history';

import {GridColumnOrder, GridColumnSortBy} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';

interface TableHeadProps<K> {
  currentSort?: GridColumnSortBy<K> | null;
  generateSortLink?: (column: K) => () => LocationDescriptorObject | undefined;
  onClick?(column: GridColumnOrder<K>, e: React.MouseEvent<HTMLAnchorElement>): void;
  rightAlignedColumns?: Set<K>;
  sortableColumns?: Set<K>;
}

export function renderTableHead<K>({
  currentSort,
  generateSortLink,
  rightAlignedColumns,
  sortableColumns,
  onClick,
}: TableHeadProps<K>) {
  return function (column: GridColumnOrder<K>, _columnIndex: number) {
    return (
      <SortLink
        onClick={e => onClick?.(column, e)}
        align={rightAlignedColumns?.has(column.key) ? 'right' : 'left'}
        title={column.name}
        direction={currentSort?.key === column.key ? currentSort?.order : undefined}
        canSort={sortableColumns?.has(column.key) || false}
        generateSortLink={generateSortLink?.(column.key) ?? (() => undefined)}
        replace
      />
    );
  };
}
