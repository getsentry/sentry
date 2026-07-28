import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  RefObject,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {useColumnResize} from 'sentry/components/tables/useColumnResize';
import {defined} from 'sentry/utils/defined';

import {
  TABLE_BODY_ROW_HEIGHT,
  TABLE_HEAD_ROW_HEIGHT,
  TableBody,
  TableCell,
  TableGrid,
  TableHead,
  TableHeadCell,
  TableResizer,
  TableRow,
  TableStatusCell,
} from './styles';

export {TABLE_BODY_ROW_HEIGHT, TABLE_HEAD_ROW_HEIGHT};

export const COL_WIDTH_UNDEFINED = -1;

// Set to 90 as the edit/trash icons need this much space.
export const COL_WIDTH_MINIMUM = 90;

export interface TableColumnConfig {
  key: string;
  resizable?: boolean;
  width?: number | string;
}

type ResolvedWidth = number | string | undefined;

export function getDefaultColumnTrack(
  width: ResolvedWidth,
  {
    isLast,
    lastColumnFlexible,
    minimumColumnWidth,
  }: {isLast: boolean; lastColumnFlexible: boolean; minimumColumnWidth: number}
): string {
  const flexible = isLast && lastColumnFlexible;

  if (typeof width === 'string') {
    return width;
  }

  if (!defined(width) || width === COL_WIDTH_UNDEFINED) {
    return `minmax(${minimumColumnWidth}px, auto)`;
  }

  if (width > minimumColumnWidth) {
    return flexible ? `minmax(${width}px, auto)` : `${width}px`;
  }

  return flexible ? `minmax(${minimumColumnWidth}px, auto)` : `${minimumColumnWidth}px`;
}

interface TableContextValue {
  columnIndexByKey: Map<string, number>;
  dataRows: number;
  lastColumnIndex: number;
  onResetColumnSize: (event: React.MouseEvent, index: number) => void;
  onResizeMouseDown: (event: React.MouseEvent, index: number) => void;
  resizableByIndex: boolean[];
  tableRef: RefObject<HTMLTableElement | null>;
  headRowHeight?: number;
}

const TableContext = createContext<TableContextValue | null>(null);

function useTableContext() {
  return useContext(TableContext);
}

const DETACHED_TABLE_REF: RefObject<HTMLTableElement | null> = {current: null};

export function useTableElement() {
  return useTableContext()?.tableRef ?? DETACHED_TABLE_REF;
}

const EMPTY_COLUMNS: TableColumnConfig[] = [];

export interface TableProps extends Omit<
  HTMLAttributes<HTMLTableElement>,
  'children' | 'onResize'
> {
  children: ReactNode;
  columns?: TableColumnConfig[];
  dataRows?: number;
  fit?: 'max-content';
  getColumnTrack?: (
    width: ResolvedWidth,
    column: TableColumnConfig,
    index: number
  ) => string;
  gridTemplateColumns?: string;
  headRowHeight?: number;
  height?: CSSProperties['height'];
  /**
   * Whether the last column absorbs slack via `minmax()`.
   *
   * @default true
   */
  lastColumnFlexible?: boolean;
  minimumColumnWidth?: number;
  onColumnResize?: (index: number, width: number) => void;
  prependColumnWidths?: string[];
  ref?: RefObject<HTMLTableElement | null>;
  scrollable?: boolean;
  stickyHeader?: boolean;
  writeResizerHeightVar?: boolean;
}

export function Table({
  children,
  columns = EMPTY_COLUMNS,
  dataRows = 0,
  fit,
  getColumnTrack,
  gridTemplateColumns,
  headRowHeight,
  height,
  lastColumnFlexible = true,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  onColumnResize,
  prependColumnWidths,
  ref,
  scrollable,
  stickyHeader: _stickyHeader,
  writeResizerHeightVar = true,
  ...props
}: TableProps) {
  const internalRef = useRef<HTMLTableElement>(null);
  const gridRef = ref ?? internalRef;

  const [internalWidths, setInternalWidths] = useState<Record<string, number>>({});
  const isControlled = defined(onColumnResize);

  const resolveWidth = useCallback(
    (column: TableColumnConfig): ResolvedWidth =>
      isControlled ? column.width : (internalWidths[column.key] ?? column.width),
    [internalWidths, isControlled]
  );

  const buildTemplate = useCallback(
    (overrideIndex?: number, overrideWidth?: number) => {
      const tracks = columns.map((column, index) => {
        const width = index === overrideIndex ? overrideWidth : resolveWidth(column);

        return getColumnTrack
          ? getColumnTrack(width, column, index)
          : getDefaultColumnTrack(width, {
              isLast: index === columns.length - 1,
              lastColumnFlexible,
              minimumColumnWidth,
            });
      });

      if (!tracks.length) {
        return gridTemplateColumns ?? '';
      }

      return [...(prependColumnWidths ?? []), ...tracks].join(' ');
    },
    [
      columns,
      getColumnTrack,
      gridTemplateColumns,
      lastColumnFlexible,
      minimumColumnWidth,
      prependColumnWidths,
      resolveWidth,
    ]
  );

  const {onResizeMouseDown, applyTemplate} = useColumnResize({
    gridRef,
    getResizeTemplate: (index, newWidth) =>
      buildTemplate(index, Math.max(newWidth, minimumColumnWidth)),
    onColumnResizeEnd: (index, newWidth) => {
      const width = Math.max(newWidth, minimumColumnWidth);
      const key = columns[index]?.key;

      if (onColumnResize) {
        onColumnResize(index, width);
      } else if (key) {
        setInternalWidths(current => ({...current, [key]: width}));
      }
    },
    writeResizerHeightVar,
  });

  const onResetColumnSize = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.stopPropagation();

      const key = columns[index]?.key;

      applyTemplate(buildTemplate(index, COL_WIDTH_UNDEFINED));

      if (onColumnResize) {
        onColumnResize(index, COL_WIDTH_UNDEFINED);
      } else if (key) {
        setInternalWidths(current => ({...current, [key]: COL_WIDTH_UNDEFINED}));
      }
    },
    [applyTemplate, buildTemplate, columns, onColumnResize]
  );

  const redraw = useCallback(() => {
    applyTemplate(buildTemplate());
  }, [applyTemplate, buildTemplate]);

  useEffect(() => {
    redraw();
  }, [redraw, dataRows]);

  useEffect(() => {
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [redraw]);

  const contextValue = useMemo<TableContextValue>(
    () => ({
      columnIndexByKey: new Map(columns.map((column, index) => [column.key, index])),
      dataRows,
      headRowHeight,
      lastColumnIndex: columns.length - 1,
      onResetColumnSize,
      onResizeMouseDown,
      resizableByIndex: columns.map(column => column.resizable !== false),
      tableRef: gridRef,
    }),
    [columns, dataRows, gridRef, headRowHeight, onResetColumnSize, onResizeMouseDown]
  );

  return (
    <TableContext value={contextValue}>
      <TableGrid
        {...props}
        fit={fit}
        headRowHeight={headRowHeight}
        height={height}
        ref={gridRef}
        role="table"
        scrollable={scrollable}
      >
        {children}
      </TableGrid>
    </TableContext>
  );
}

interface SectionProps extends HTMLAttributes<HTMLTableSectionElement> {
  ref?:
    | RefObject<HTMLTableSectionElement | null>
    | ((node: HTMLTableSectionElement | null) => void);
}

function Head({
  children,
  sticky,
  stickyZIndex,
  ...props
}: SectionProps & {sticky?: boolean; stickyZIndex?: number}) {
  return (
    <TableHead {...props} role="rowgroup" sticky={sticky} stickyZIndex={stickyZIndex}>
      {children}
    </TableHead>
  );
}

function Body({children, ...props}: SectionProps) {
  return (
    <TableBody {...props} role="rowgroup">
      {children}
    </TableBody>
  );
}

function Row({
  children,
  divider,
  ref,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  divider?: boolean;
  ref?:
    | RefObject<HTMLTableRowElement | null>
    | ((node: HTMLTableRowElement | null) => void);
}) {
  return (
    <TableRow {...props} divider={divider} ref={ref} role="row">
      {children}
    </TableRow>
  );
}

interface HeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  column?: string;
  columnIndex?: number;
}

function HeadCell({children, column, columnIndex, ...props}: HeadCellProps) {
  const context = useTableContext();
  const index =
    columnIndex ?? (defined(column) ? context?.columnIndexByKey.get(column) : undefined);

  const showResizer =
    defined(context) &&
    defined(index) &&
    index !== context.lastColumnIndex &&
    context.resizableByIndex[index] === true;

  return (
    <TableHeadCell {...props} role="columnheader">
      {children}
      {showResizer && (
        <TableResizer
          data-test-id="table-column-resizer"
          dataRows={context.dataRows}
          headRowHeight={context.headRowHeight}
          onContextMenu={event => context.onResizeMouseDown(event, index)}
          onDoubleClick={event => context.onResetColumnSize(event, index)}
          onMouseDown={event => context.onResizeMouseDown(event, index)}
        />
      )}
    </TableHeadCell>
  );
}

function Cell({children, ...props}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableCell {...props} role="cell">
      {children}
    </TableCell>
  );
}

function Status({children, ...props}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableRow role="row">
      <TableStatusCell {...props} role="cell">
        {children}
      </TableStatusCell>
    </TableRow>
  );
}

function StatusBody({children, ...props}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableBody role="rowgroup">
      <Status {...props}>{children}</Status>
    </TableBody>
  );
}

Table.Body = Body;
Table.Cell = Cell;
Table.Head = Head;
Table.HeadCell = HeadCell;
Table.Row = Row;
Table.Status = Status;
Table.StatusBody = StatusBody;
