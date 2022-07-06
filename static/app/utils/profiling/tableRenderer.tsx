import {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';

export function renderTableHead<K>(rightAlignedColumns: Set<K>) {
  return (column: GridColumnOrder<K>, _columnIndex: number) => {
    return (
      <SortLink
        align={rightAlignedColumns.has(column.key) ? 'right' : 'left'}
        title={column.name}
        direction={undefined}
        canSort={false}
        generateSortLink={() => undefined}
      />
    );
  };
}
