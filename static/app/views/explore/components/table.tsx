import type React from 'react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {COL_WIDTH_MINIMUM} from 'sentry/components/tables/gridEditable';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import {
  Body as _TableWrapper,
  Grid as _Table,
  GridBody,
  GridBodyCell,
  GridBodyCellStatus,
  GridHead,
  GridHeadCell,
  GridRow,
} from 'sentry/components/tables/gridEditable/styles';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {Actions} from 'sentry/views/discover/table/cellAction';

interface TableProps extends React.ComponentProps<typeof _TableWrapper> {
  ref?: React.Ref<HTMLTableElement>;
  showVerticalScrollbar?: boolean;
  // Size of the loading element in order to match the height of the row.
  size?: number;
}

export function Table({ref, children, style, ...props}: TableProps) {
  return (
    <_TableWrapper {...props}>
      <_Table ref={ref} style={style}>
        {children}
      </_Table>
    </_TableWrapper>
  );
}

interface TableStatusProps {
  children: React.ReactNode;
  size?: number;
}

export function TableStatus({children, size}: TableStatusProps) {
  return (
    <GridRow>
      <GridBodyCellStatus size={size}>{children}</GridBodyCellStatus>
    </GridRow>
  );
}

export const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.SHOW_GREATER_THAN,
  Actions.SHOW_LESS_THAN,
  Actions.COPY_TO_CLIPBOARD,
];

const MINIMUM_COLUMN_WIDTH = COL_WIDTH_MINIMUM;

export function useTableStyles(
  fields: any[],
  tableRef: React.RefObject<HTMLDivElement | null>,
  options?: {
    minimumColumnWidth?: number;
    prefixColumnWidth?: 'min-content' | number;
    staticColumnWidths?: Record<string, number | '1fr'>;
  }
) {
  const minimumColumnWidth = options?.minimumColumnWidth ?? MINIMUM_COLUMN_WIDTH;
  const prefixColumnWidth =
    defined(options?.prefixColumnWidth) && typeof options.prefixColumnWidth === 'number'
      ? `${options.prefixColumnWidth}px`
      : options?.prefixColumnWidth;

  const resizingColumnIndex = useRef<number | null>(null);
  const columnWidthsRef = useRef<Array<number | null>>(fields.map(() => null));

  useEffect(() => {
    columnWidthsRef.current = fields.map(
      (_, index) => columnWidthsRef.current[index] ?? null
    );
  }, [fields]);

  const initialTableStyles = useMemo(() => {
    const gridTemplateColumns = fields.map(field => {
      const staticWidth = options?.staticColumnWidths?.[field];
      if (staticWidth) {
        return typeof staticWidth === 'number' ? `${staticWidth}px` : staticWidth;
      }
      return `minmax(${minimumColumnWidth}px, auto)`;
    });
    if (defined(prefixColumnWidth)) {
      gridTemplateColumns.unshift(prefixColumnWidth);
    }
    return {
      gridTemplateColumns: gridTemplateColumns.join(' '),
    };
  }, [fields, minimumColumnWidth, prefixColumnWidth, options?.staticColumnWidths]);

  const onResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();

      // <GridResizer> is expected to be nested 1 level down from <GridHeadCell>
      const cell = event.currentTarget.parentElement;
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
          minimumColumnWidth,
          initialWidth + (e.clientX - startX)
        );

        columnWidthsRef.current[index] = newWidth;

        // Updating the grid's `gridTemplateColumns` directly
        const gridTemplateColumns = columnWidthsRef.current.map(width => {
          return typeof width === 'number'
            ? `${width}px`
            : `minmax(${minimumColumnWidth}px, auto)`;
        });
        if (defined(prefixColumnWidth)) {
          gridTemplateColumns.unshift(prefixColumnWidth);
        }
        gridElement.style.gridTemplateColumns = gridTemplateColumns.join(' ');
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
    [tableRef, minimumColumnWidth, prefixColumnWidth]
  );

  return {initialTableStyles, onResizeMouseDown};
}

export const TableBody = GridBody;
export const TableRow = GridRow;
export const TableBodyCell = GridBodyCell;

export const TableHead = GridHead;
export const TableHeadCell = styled(GridHeadCell)<{align?: Alignments}>`
  ${p => p.align && `justify-content: ${p.align};`}
`;
export const TableHeadCellContent = styled('div')<{isFrozen?: boolean | undefined}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  cursor: ${p => (p.isFrozen ? 'default' : 'pointer')};
`;
