import type {
  ComponentProps,
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {useColumnResize} from 'sentry/components/tables/useColumnResize';
import {defined} from 'sentry/utils/defined';

import {
  TableBody,
  TableCell,
  TableGrid,
  TableHead,
  TableHeadCell,
  TableResizer,
  TableRow,
  TableStatusCell,
} from './styles';

export const COL_WIDTH_UNDEFINED = -1;

// Set to 90 as the edit/trash icons need this much space.
export const COL_WIDTH_MINIMUM = 90;

export interface TableColumnConfig {
  key: string;
  resizable?: boolean;
  width?: number | string;
}

type ResolvedWidth = number | string | undefined;

function getDefaultColumnTrack(
  width: ResolvedWidth,
  {flexible, minimumColumnWidth}: {flexible: boolean; minimumColumnWidth: number}
): string {
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
  lastColumnIndex: number;
  onResetColumnSize: (event: React.MouseEvent, index: number) => void;
  onResizeMouseDown: (event: React.MouseEvent, index: number) => void;
  resizableByIndex: boolean[];
  tableRef: RefObject<HTMLTableElement | null>;
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
  definiteHeadRow?: boolean;
  fit?: 'max-content';
  getColumnTrack?: (
    width: ResolvedWidth,
    column: TableColumnConfig,
    index: number
  ) => string;
  height?: CSSProperties['height'];
  minimumColumnWidth?: number;
  onColumnResize?: (index: number, width: number) => void;
  prependColumnWidths?: string[];
  ref?: RefObject<HTMLTableElement | null>;
  scrollable?: boolean;
}

export function Table({
  children,
  columns = EMPTY_COLUMNS,
  definiteHeadRow,
  fit,
  getColumnTrack,
  height,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  onColumnResize,
  prependColumnWidths,
  ref,
  scrollable,
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
              flexible: index === columns.length - 1,
              minimumColumnWidth,
            });
      });

      if (!tracks.length) {
        return '';
      }

      return [...(prependColumnWidths ?? []), ...tracks].join(' ');
    },
    [columns, getColumnTrack, minimumColumnWidth, prependColumnWidths, resolveWidth]
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
    writeResizerHeightVar: true,
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

  const template = buildTemplate();

  const redraw = useCallback(() => {
    // An empty template means the shell has no opinion about tracks, so writing
    // it would clobber whatever the consumer set via CSS or an inline style.
    if (template) {
      applyTemplate(template);
    }
  }, [applyTemplate, template]);

  useLayoutEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [redraw]);

  const contextValue = useMemo<TableContextValue>(
    () => ({
      columnIndexByKey: new Map(columns.map((column, index) => [column.key, index])),
      lastColumnIndex: columns.length - 1,
      onResetColumnSize,
      onResizeMouseDown,
      resizableByIndex: columns.map(column => column.resizable !== false),
      tableRef: gridRef,
    }),
    [columns, gridRef, onResetColumnSize, onResizeMouseDown]
  );

  return (
    <TableContext value={contextValue}>
      <TableGrid
        {...props}
        definiteHeadRow={definiteHeadRow}
        fit={fit}
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

function Head(props: ComponentProps<typeof TableHead>) {
  return <TableHead role="rowgroup" {...props} />;
}

function Body(props: ComponentProps<typeof TableBody>) {
  return <TableBody role="rowgroup" {...props} />;
}

function Row(props: ComponentProps<typeof TableRow>) {
  return <TableRow role="row" {...props} />;
}

function Cell(props: ComponentProps<typeof TableCell>) {
  return <TableCell role="cell" {...props} />;
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
          onContextMenu={event => context.onResizeMouseDown(event, index)}
          onDoubleClick={event => context.onResetColumnSize(event, index)}
          onMouseDown={event => context.onResizeMouseDown(event, index)}
        />
      )}
    </TableHeadCell>
  );
}

function Status({children, ...props}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <Row>
      <TableStatusCell {...props} role="cell">
        {children}
      </TableStatusCell>
    </Row>
  );
}

function StatusBody(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <Body>
      <Status {...props} />
    </Body>
  );
}

Table.Body = Body;
Table.Cell = Cell;
Table.Head = Head;
Table.HeadCell = HeadCell;
Table.Row = Row;
Table.Status = Status;
Table.StatusBody = StatusBody;
