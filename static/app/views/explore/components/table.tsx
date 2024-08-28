import {useMemo} from 'react';

import {COL_WIDTH_MINIMUM} from 'sentry/components/gridEditable';
import {
  Body as _TableWrapper,
  Grid as _Table,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridHead,
  GridHeadCell,
  GridRow,
  Header,
  HeaderButtonContainer,
  HeaderTitle,
} from 'sentry/components/gridEditable/styles';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {}

export function Table({children, style, ...props}: TableProps) {
  return (
    <_TableWrapper {...props}>
      <_Table style={style}>{children}</_Table>
    </_TableWrapper>
  );
}

interface TableStatusProps {
  children: React.ReactNode;
}

export function TableStatus({children}: TableStatusProps) {
  return (
    <GridRow>
      <GridBodyCellStatus>{children}</GridBodyCellStatus>
    </GridRow>
  );
}

const MINIMUM_COLUMN_WIDTH = COL_WIDTH_MINIMUM;

type Item = {
  label: string;
  value: React.ReactNode;
  width?: number | 'min-content';
};

interface UseTableStylesOptions {
  items: Item[];
  minimumColumnWidth?: number;
}

export function useTableStyles({
  items,
  minimumColumnWidth = MINIMUM_COLUMN_WIDTH,
}: UseTableStylesOptions) {
  const tableStyles = useMemo(() => {
    const columns = new Array(items.length);

    for (let i = 0; i < items.length; i++) {
      if (typeof items[i].width === 'number') {
        columns[i] = `${items[i].width}px`;
      } else {
        columns[i] = items[i].width ?? `minmax(${minimumColumnWidth}px, auto)`;
      }
    }

    return {
      gridTemplateColumns: columns.join(' '),
    };
  }, [items, minimumColumnWidth]);

  return {tableStyles};
}

export const TableBody = GridBody;
export const TableBodyCell = GridBodyCell;
export const TableHead = GridHead;
export const TableHeadCell = GridHeadCell;
export const TableHeader = Header;
export const TableHeaderActions = HeaderButtonContainer;
export const TableHeaderTitle = HeaderTitle;
export const TableRow = GridRow;
