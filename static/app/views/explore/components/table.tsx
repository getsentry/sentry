import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {COL_WIDTH_MINIMUM} from 'sentry/components/gridEditable';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
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
import {space} from 'sentry/styles/space';
import {Actions} from 'sentry/views/discover/table/cellAction';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({children, styles, ...props}, ref) => (
    <_TableWrapper {...props}>
      <_Table ref={ref} style={styles}>
        {children}
      </_Table>
    </_TableWrapper>
  )
);

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

export const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.SHOW_GREATER_THAN,
  Actions.SHOW_LESS_THAN,
  Actions.COPY,
];

const MINIMUM_COLUMN_WIDTH = COL_WIDTH_MINIMUM;

export function useTableStyles(
  fields: string[],
  tableRef: React.RefObject<HTMLDivElement>,
  minimumColumnWidth = MINIMUM_COLUMN_WIDTH
) {
  const resizingColumnIndex = useRef<number | null>(null);
  const columnWidthsRef = useRef<(number | null)[]>(fields.map(() => null));

  useEffect(() => {
    columnWidthsRef.current = fields.map(
      (_, index) => columnWidthsRef.current[index] ?? null
    );
  }, [fields]);

  const initialTableStyles = useMemo(
    () => ({
      gridTemplateColumns: fields
        .map(() => `minmax(${minimumColumnWidth}px, auto)`)
        .join(' '),
    }),
    [fields, minimumColumnWidth]
  );

  const onResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();

      // <GridResizer> is expected to be nested 1 level down from <GridHeadCell>
      const cell = event.currentTarget!.parentElement;
      if (!cell) {
        return;
      }

      resizingColumnIndex.current = index;

      const startX = event.clientX;
      const initialWidth = cell.offsetWidth;

      const gridElement = tableRef.current;

      function onMouseMove(e: MouseEvent) {
        if (resizingColumnIndex.current === null || !gridElement) {
          return;
        }

        const newWidth = Math.max(
          MINIMUM_COLUMN_WIDTH,
          initialWidth + (e.clientX - startX)
        );

        columnWidthsRef.current[index] = newWidth;

        // Updating the grid's `gridTemplateColumns` directly
        gridElement.style.gridTemplateColumns = columnWidthsRef.current
          .map(width => {
            return typeof width === 'number'
              ? `${width}px`
              : `minmax(${minimumColumnWidth}px, auto)`;
          })
          .join(' ');
      }

      function onMouseUp() {
        resizingColumnIndex.current = null;

        // Cleaning up event listeners
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [tableRef, minimumColumnWidth]
  );

  return {initialTableStyles, onResizeMouseDown};
}

export const TableBody = GridBody;
export const TableRow = GridRow;
export const TableBodyCell = GridBodyCell;

export const TableHead = GridHead;
export const TableHeader = Header;
export const TableHeaderActions = HeaderButtonContainer;
export const TableHeaderTitle = HeaderTitle;
export const TableHeadCell = styled(GridHeadCell)<{align?: Alignments}>`
  ${p => p.align && `justify-content: ${p.align};`}
`;
export const TableHeadCellContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  cursor: pointer;
`;
