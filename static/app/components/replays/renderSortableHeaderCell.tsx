import type {MouseEvent} from 'react';
import type {LocationDescriptorObject} from 'history';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Sort} from 'sentry/utils/discover/fields';

interface Props<Key extends string> {
  currentSort: Sort;
  makeSortLinkGenerator: (column: GridColumnOrder<Key>) => () => LocationDescriptorObject;
  onClick(column: GridColumnOrder<Key>, e: MouseEvent<HTMLAnchorElement>): void;
  rightAlignedColumns: Array<GridColumnOrder<string>>;
  sortableColumns: Array<GridColumnOrder<string>>;
}

export default function renderSortableHeaderCell<Key extends string>({
  currentSort,
  onClick,
  rightAlignedColumns,
  sortableColumns,
  makeSortLinkGenerator,
}: Props<Key>) {
  return function (column: GridColumnOrder<Key>, _columnIndex: number) {
    return (
      <SortLink
        onClick={e => onClick(column, e)}
        align={rightAlignedColumns.includes(column) ? 'right' : 'left'}
        title={column.name}
        direction={currentSort?.field === column.key ? currentSort?.kind : undefined}
        canSort={sortableColumns.includes(column)}
        generateSortLink={makeSortLinkGenerator(column)}
        replace
      />
    );
  };
}
