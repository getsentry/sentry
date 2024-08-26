import {useMemo} from 'react';

import {COL_WIDTH_MINIMUM} from 'sentry/components/gridEditable';
import {
  Body as _TableWrapper,
  Grid as _Table,
  GridBody,
  GridBodyCell,
  GridHead,
  GridHeadCell,
  GridRow,
} from 'sentry/components/gridEditable/styles';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {}

export function Table({children, style, ...props}: TableProps) {
  return (
    <_TableWrapper {...props}>
      <_Table style={style}>{children}</_Table>
    </_TableWrapper>
  );
}

const MINIMUM_COLUMN_WIDTH = COL_WIDTH_MINIMUM;

interface UseTableStylesOptions {
  items: any[];
  minimumColumnWidth?: number;
}

export function useTableStyles({
  items,
  minimumColumnWidth = MINIMUM_COLUMN_WIDTH,
}: UseTableStylesOptions) {
  const tableStyles = useMemo(() => {
    const columns = new Array(items.length).fill(`minmax(${minimumColumnWidth}px, auto)`);

    return {
      gridTemplateColumns: columns.join(' '),
    };
  }, [items.length, minimumColumnWidth]);

  return {tableStyles};
}

export const TableBody = GridBody;
export const TableBodyCell = GridBodyCell;
export const TableHead = GridHead;
export const TableHeadCell = GridHeadCell;
export const TableRow = GridRow;
