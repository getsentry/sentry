import type {
  ComponentProps,
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
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {DragHandle} from '@sentry/scraps/dragHandle';

import {
  getAriaSort,
  SortableHeaderCell,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {useColumnResize} from 'sentry/components/tables/useColumnResize';
import {useObservedColumnSize} from 'sentry/components/tables/useObservedColumnSize';

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

// Auto layout width.
export const COL_WIDTH_UNDEFINED = -1;

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

  if (width === undefined || width === COL_WIDTH_UNDEFINED) {
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
  minimumColumnWidth: number;
  onResetColumnSize: (event: React.MouseEvent, index: number) => void;
  onResizeEnd: () => void;
  onResizeMove: (delta: number) => void;
  onResizeStart: (index: number, cell: HTMLElement | null) => void;
  resizableByIndex: boolean[];
}

const TableContext = createContext<TableContextValue | null>(null);

function useTableContext() {
  return useContext(TableContext);
}

const EMPTY_COLUMNS: TableColumnConfig[] = [];

export interface TableProps extends Omit<
  HTMLAttributes<HTMLTableElement>,
  'children' | 'onResize'
> {
  children: ReactNode;
  columns?: TableColumnConfig[];
  flexibleLastColumn?: boolean;
  minimumColumnWidth?: number;
  onColumnResize?: (index: number, width: number) => void;
  prependColumnWidths?: string[];
  ref?: RefObject<HTMLTableElement | null>;
}

export function Table({
  children,
  columns = EMPTY_COLUMNS,
  flexibleLastColumn = true,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  onColumnResize,
  prependColumnWidths,
  ref,
  ...props
}: TableProps) {
  const internalRef = useRef<HTMLTableElement>(null);
  const gridRef = ref ?? internalRef;

  const [internalWidths, setInternalWidths] = useState<Record<string, number>>({});
  const isControlled = !!onColumnResize;

  const resolveWidth = useCallback(
    (column: TableColumnConfig): ResolvedWidth =>
      isControlled ? column.width : (internalWidths[column.key] ?? column.width),
    [internalWidths, isControlled]
  );

  const buildTemplate = useCallback(
    (overrideIndex?: number, overrideWidth?: number) => {
      const tracks = columns.map((column, index) =>
        getDefaultColumnTrack(
          index === overrideIndex ? overrideWidth : resolveWidth(column),
          {
            flexible: flexibleLastColumn && index === columns.length - 1,
            minimumColumnWidth,
          }
        )
      );

      if (!tracks.length) {
        return '';
      }

      return [...(prependColumnWidths ?? []), ...tracks].join(' ');
    },
    [columns, flexibleLastColumn, minimumColumnWidth, prependColumnWidths, resolveWidth]
  );

  const commitWidth = useCallback(
    (index: number, width: number) => {
      const key = columns[index]?.key;

      if (onColumnResize) {
        onColumnResize(index, width);
      } else if (key) {
        setInternalWidths(current => ({...current, [key]: width}));
      }
    },
    [columns, onColumnResize]
  );

  const getResizeTemplate = useCallback(
    (index: number, newWidth: number) =>
      buildTemplate(index, Math.max(newWidth, minimumColumnWidth)),
    [buildTemplate, minimumColumnWidth]
  );

  const onColumnResizeEnd = useCallback(
    (index: number, newWidth: number) =>
      commitWidth(index, Math.max(newWidth, minimumColumnWidth)),
    [commitWidth, minimumColumnWidth]
  );

  const {applyTemplate, onResizeEnd, onResizeMove, onResizeStart} = useColumnResize({
    gridRef,
    getResizeTemplate,
    onColumnResizeEnd,
  });

  const onResetColumnSize = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.stopPropagation();

      applyTemplate(buildTemplate(index, COL_WIDTH_UNDEFINED));
      commitWidth(index, COL_WIDTH_UNDEFINED);
    },
    [applyTemplate, buildTemplate, commitWidth]
  );

  const template = buildTemplate();

  const redraw = useCallback(() => {
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
      minimumColumnWidth,
      onResetColumnSize,
      onResizeEnd,
      onResizeMove,
      onResizeStart,
      resizableByIndex: columns.map(column => column.resizable !== false),
    }),
    [
      columns,
      minimumColumnWidth,
      onResetColumnSize,
      onResizeEnd,
      onResizeMove,
      onResizeStart,
    ]
  );

  return (
    <TableContext value={contextValue}>
      <TableGrid
        {...props}
        ref={gridRef}
        role="table"
        style={template ? {...props.style, gridTemplateColumns: template} : props.style}
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
  /**
   * Identifies the column by position, for callers that render their head cells
   * from an ordered list rather than from a keyed column config.
   */
  columnIndex?: number;
  onSort?: () => void;
  overlays?: ReactNode;
  sort?: SortDirection;
}

function HeadCell({
  children,
  column,
  columnIndex,
  onSort,
  overlays,
  sort,
  ...props
}: HeadCellProps) {
  const context = useTableContext();
  const index =
    columnIndex ??
    (column === undefined ? undefined : context?.columnIndexByKey.get(column));

  const showResizer =
    context !== null &&
    index !== undefined &&
    index !== context.lastColumnIndex &&
    context.resizableByIndex[index] === true;

  const sortable = !!onSort || !!sort || !!overlays;

  const cellRef = useRef<HTMLTableCellElement>(null);
  const {max, width} = useObservedColumnSize(cellRef);
  const fallbackId = useId();
  const cellId = props.id || fallbackId;

  return (
    <TableHeadCell
      aria-sort={getAriaSort(sort)}
      {...props}
      id={cellId}
      ref={cellRef}
      role="columnheader"
    >
      {sortable ? (
        <SortableHeaderCell direction={sort} onSort={onSort} overlays={overlays}>
          {children}
        </SortableHeaderCell>
      ) : (
        children
      )}
      {showResizer && (
        <TableResizer onContextMenu={event => event.preventDefault()}>
          <DragHandle
            aria-labelledby={cellId}
            isSizedFirst
            max={Math.max(max, context.minimumColumnWidth)}
            min={context.minimumColumnWidth}
            orientation="horizontal"
            value={Math.max(width, context.minimumColumnWidth)}
            variant="ghost"
            onDoubleClick={event => context.onResetColumnSize(event, index)}
            onMove={context.onResizeMove}
            onMoveEnd={context.onResizeEnd}
            onMoveStart={() => context.onResizeStart(index, cellRef.current)}
          />
        </TableResizer>
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
