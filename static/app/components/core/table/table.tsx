import type {
  ComponentProps,
  HTMLAttributes,
  ReactNode,
  Ref,
  RefObject,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {LocationDescriptor} from 'history';

import {DragHandle} from '@sentry/scraps/dragHandle';
import {type Responsive, useResponsivePropResolver} from '@sentry/scraps/layout';
import {useStableMergeRef} from '@sentry/scraps/useStableMergeRef';

import {
  COLUMN_ALIGN_JUSTIFY,
  type ColumnAlign,
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
  /**
   * Whether the column takes part in the layout, defaulting to `true`. A
   * responsive value drops the column's track from the grid template and hides
   * the cells in that position as the container crosses a breakpoint, and starts
   * out hidden: `{'3xl': true}` is the same as `{zero: false, '3xl': true}`.
   *
   * Cells are matched to columns by position, so every column a row renders a
   * cell for needs an entry here, in the order the cells are rendered.
   */
  visible?: Responsive<boolean>;
  width?: Responsive<number | string>;
}

interface ResolvedColumn extends Omit<TableColumnConfig, 'visible' | 'width'> {
  hidden: boolean;
  width?: number | string;
}

type ResolvedWidth = number | string | undefined;

function withHiddenBase(visible: Responsive<boolean> | undefined): Responsive<boolean> {
  if (visible === undefined || typeof visible === 'boolean') {
    return visible ?? true;
  }

  return {zero: false, ...visible};
}

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

function isFlexibleWidth(width: ResolvedWidth) {
  // Content-sized minimums promise never to truncate, which a pinned width can't keep.
  if (typeof width === 'string') {
    return /\bauto\b|fr\b/.test(width) && !width.includes('content');
  }

  return width === undefined || width === COL_WIDTH_UNDEFINED;
}

interface TableContextValue {
  lastColumnIndex: number;
  minimumColumnWidth: number;
  onResetColumnSize: (event: React.MouseEvent, index: number) => void;
  onResizeEnd: () => void;
  onResizeMove: (delta: number) => void;
  onResizeStart: (index: number, cell: HTMLElement | null) => void;
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

  const resolveResponsiveProp = useResponsivePropResolver();

  // Responsive `width` and `visible` are resolved here rather than emitted as
  // `@container` rules because the grid template is an inline style, which any
  // stylesheet rule would lose to.
  const resolvedColumns: ResolvedColumn[] = [];

  for (const {visible, width, ...column} of columns) {
    resolvedColumns.push({
      ...column,
      hidden: !resolveResponsiveProp(withHiddenBase(visible)),
      width: resolveResponsiveProp(width),
    });
  }

  const lastVisibleIndex = resolvedColumns.findLastIndex(column => !column.hidden);

  const resolveWidth = (column: ResolvedColumn): ResolvedWidth =>
    isControlled ? column.width : (internalWidths[column.key] ?? column.width);

  const buildTemplate = (overrides?: ReadonlyMap<number, number>) => {
    const tracks = resolvedColumns.flatMap((column, index) =>
      column.hidden
        ? []
        : getDefaultColumnTrack(overrides?.get(index) ?? resolveWidth(column), {
            flexible: flexibleLastColumn && index === lastVisibleIndex,
            minimumColumnWidth,
          })
    );

    if (!tracks.length) {
      return '';
    }

    return [...(prependColumnWidths ?? []), ...tracks].join(' ');
  };

  const commitWidth = (index: number, width: number) => {
    const key = resolvedColumns[index]?.key;

    if (onColumnResize) {
      onColumnResize(index, width);
    } else if (key) {
      setInternalWidths(current => ({...current, [key]: width}));
    }
  };

  // A flexible column left of the dragged one would otherwise absorb the width
  // change, leaving the handle in place while the columns before it move.
  // Without a flexible last column, pinning could leave no column to absorb
  // later container width changes, so those tables keep their flexible columns.
  const measurePinnedWidths = (draggedIndex: number) => {
    const pinned = new Map<number, number>();
    const grid = gridRef.current;
    if (!grid || !flexibleLastColumn) {
      return pinned;
    }

    // Computed tracks are only usable once the browser has resolved them to pixels.
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ');
    if (!tracks.every(track => track.endsWith('px'))) {
      return pinned;
    }

    const columnTracks = tracks.slice(prependColumnWidths?.length ?? 0).values();

    for (const [index, column] of resolvedColumns.slice(0, draggedIndex).entries()) {
      if (column.hidden) {
        continue;
      }

      const trackWidth = Math.round(parseFloat(columnTracks.next().value ?? ''));

      // A column without a handle could never be reset to flexible again, and one
      // narrower than the minimum would jump wider when pinned.
      if (
        column.resizable !== false &&
        isFlexibleWidth(resolveWidth(column)) &&
        trackWidth >= minimumColumnWidth
      ) {
        pinned.set(index, trackWidth);
      }
    }

    return pinned;
  };

  const withResizedWidth = (
    pinnedWidths: ReadonlyMap<number, number>,
    index: number,
    width: number
  ) => new Map(pinnedWidths).set(index, Math.max(width, minimumColumnWidth));

  const {applyTemplate, onResizeEnd, onResizeMove, onResizeStart} = useColumnResize({
    gridRef,
    getResizeTemplate: (index, newWidth, pinnedWidths) =>
      buildTemplate(withResizedWidth(pinnedWidths, index, newWidth)),
    onColumnResizeEnd: (index, newWidth, pinnedWidths) => {
      for (const [columnIndex, width] of withResizedWidth(
        pinnedWidths,
        index,
        newWidth
      )) {
        commitWidth(columnIndex, width);
      }
    },
  });

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

  const contextValue: TableContextValue = {
    lastColumnIndex: lastVisibleIndex,
    minimumColumnWidth,
    onResetColumnSize: (event, index) => {
      event.stopPropagation();

      applyTemplate(buildTemplate(new Map([[index, COL_WIDTH_UNDEFINED]])));
      commitWidth(index, COL_WIDTH_UNDEFINED);
    },
    onResizeEnd,
    onResizeMove,
    onResizeStart: (index, cell) =>
      onResizeStart(index, cell, measurePinnedWidths(index)),
    resizableByIndex: resolvedColumns.map(
      column => !column.hidden && column.resizable !== false
    ),
    tableRef: gridRef,
  };

  return (
    <TableContext value={contextValue}>
      <TableGrid
        role="table"
        {...props}
        hiddenColumnIndexes={resolvedColumns.flatMap((column, index) =>
          column.hidden ? [index] : []
        )}
        ref={gridRef}
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

interface HeadCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  align?: ColumnAlign;
  /**
   * The head cell's position in `columns`, which a resizable table passes so the
   * handle knows which column it drags.
   */
  columnIndex?: number;
  onSort?: (event: React.MouseEvent) => void;
  overlays?: ReactNode;
  ref?: Ref<HTMLTableCellElement>;
  /**
   * Whether `to` should replace the history entry rather than pushing a new one.
   */
  replace?: boolean;
  sort?: SortDirection;
  /**
   * Sort destination to navigate to on sort.
   */
  to?: LocationDescriptor;
}

function HeadCell({
  align,
  children,
  columnIndex,
  onSort,
  overlays,
  ref,
  replace,
  sort,
  to,
  ...props
}: HeadCellProps) {
  const context = useTableContext();
  const index = columnIndex;

  const showResizer =
    context !== null &&
    index !== undefined &&
    index !== context.lastColumnIndex &&
    context.resizableByIndex[index] === true;

  const sortable = !!onSort || !!sort || !!overlays || !!to;

  const cellRef = useRef<HTMLTableCellElement>(null);
  const getMergedRef = useStableMergeRef(cellRef);
  const {max, width} = useObservedColumnSize(cellRef);
  const fallbackId = useId();
  const cellId = props.id || fallbackId;

  return (
    <TableHeadCell
      aria-sort={getAriaSort(sort)}
      {...props}
      id={cellId}
      justify={align && COLUMN_ALIGN_JUSTIFY[align]}
      ref={getMergedRef(ref)}
      role="columnheader"
    >
      {sortable ? (
        <SortableHeaderCell
          align={align}
          direction={sort}
          onSort={onSort}
          overlays={overlays}
          replace={replace}
          to={to}
        >
          {children}
        </SortableHeaderCell>
      ) : (
        <Fragment>
          {overlays}
          {children}
        </Fragment>
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
