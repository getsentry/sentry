import type React from 'react';
import {useMemo, type CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {COL_WIDTH_MINIMUM} from 'sentry/components/tables/gridEditable';
import type {ColumnAlign} from 'sentry/components/tables/gridEditable';
import {
  Body as _TableWrapper,
  GridBody,
  GridBodyCell,
  GridHead,
  GridHeadCell,
  GridRow,
  GridStatus,
} from 'sentry/components/tables/gridEditable/styles';
import {
  Table as SharedTable,
  type TableColumnConfig,
} from 'sentry/components/tables/table';
import {defined} from 'sentry/utils/defined';
import {Actions} from 'sentry/views/discover/table/cellAction';

export interface ExploreTableColumnOptions {
  fields?: readonly string[];
  minimumColumnWidth?: number;
  prefixColumnWidth?: 'min-content' | number;
  staticColumnWidths?: Record<string, number | string>;
}

function useExploreTableProps({
  fields,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  prefixColumnWidth,
  staticColumnWidths,
}: ExploreTableColumnOptions) {
  const columns = useMemo<TableColumnConfig[]>(
    () => (fields ?? []).map(field => ({key: field, width: staticColumnWidths?.[field]})),
    [fields, staticColumnWidths]
  );

  const prependColumnWidths = useMemo(
    () =>
      defined(prefixColumnWidth)
        ? [
            typeof prefixColumnWidth === 'number'
              ? `${prefixColumnWidth}px`
              : prefixColumnWidth,
          ]
        : [],
    [prefixColumnWidth]
  );

  return {
    columns,
    definiteHeadRow: true,
    flexibleLastColumn: false,
    minimumColumnWidth,
    prependColumnWidths,
  };
}

interface TableProps
  extends
    Omit<React.ComponentProps<typeof _TableWrapper>, 'height'>,
    ExploreTableColumnOptions {
  height?: CSSProperties['height'];
  ref?: React.RefObject<HTMLTableElement | null>;
  scrollable?: boolean;
  showVerticalScrollbar?: boolean;
}

export function Table({
  children,
  fields,
  height,
  minimumColumnWidth,
  prefixColumnWidth,
  ref,
  scrollable,
  staticColumnWidths,
  ...props
}: TableProps) {
  const tableProps = useExploreTableProps({
    fields,
    minimumColumnWidth,
    prefixColumnWidth,
    staticColumnWidths,
  });

  return (
    <_TableWrapper {...props}>
      <SharedTable {...tableProps} height={height} ref={ref} scrollable={scrollable}>
        {children}
      </SharedTable>
    </_TableWrapper>
  );
}

export {GridStatus as TableStatus};

export const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.SHOW_GREATER_THAN,
  Actions.SHOW_LESS_THAN,
  Actions.COPY_TO_CLIPBOARD,
  Actions.OPEN_EXTERNAL_LINK,
  Actions.OPEN_INTERNAL_LINK,
];

export const TableBody = GridBody;
export const TableRow = GridRow;
export const TableBodyCell = GridBodyCell;

export const TableHead = GridHead;
export const TableHeadCell = styled(GridHeadCell)<{align?: ColumnAlign}>`
  ${p =>
    p.align &&
    css`
      justify-content: ${p.align};
    `}
`;
