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

import {
  getAriaSort,
  SortableHeaderCell,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {useColumnResize} from 'sentry/components/tables/useColumnResize';
import {useObservedColumnSize} from 'sentry/components/tables/useObservedColumnSize';
import {useStableMergeRef} from 'sentry/utils/useStableMergeRef';

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
   * its cells as the container crosses a breakpoint.
   *
   * Cells name their column with `columnKey`, which is how they are hidden
   * along with their track.
   */
  visible?: Responsive<boolean>;
  width?: Responsive<number | string>;
}

interface ResolvedColumn extends Omit<TableColumnConfig, 'visible' | 'width'> {
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
  hiddenColumnKeys: Set<string>;
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

/**
 * Whether the named column is currently dropped from the table. Cells are hidden
 * rather than unrendered so that a table measured at zero width — every table
 * under jsdom — still holds its content.
 */
export function useIsColumnHidden(columnKey: string | undefined) {
  const context = useTableContext();

  return columnKey !== undefined && context?.hiddenColumnKeys.has(columnKey) === true;
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
  // stylesheet rule would lose to. Hidden columns are dropped entirely so that
  // every index downstream — resize handles, the template, the context — counts
  // only the columns currently on screen.
  const visibleColumns: ResolvedColumn[] = [];
  const hiddenColumnKeys = new Set<string>();

  for (const {visible, width, ...column} of columns) {
    if (resolveResponsiveProp(visible ?? true)) {
      visibleColumns.push({...column, width: resolveResponsiveProp(width)});
    } else {
      hiddenColumnKeys.add(column.key);
    }
  }

  const resolveWidth = (column: ResolvedColumn): ResolvedWidth =>
    isControlled ? column.width : (internalWidths[column.key] ?? column.width);

  const buildTemplate = (overrideIndex?: number, overrideWidth?: number) => {
    const tracks = visibleColumns.map((column, index) =>
      getDefaultColumnTrack(
        index === overrideIndex ? overrideWidth : resolveWidth(column),
        {
          flexible: flexibleLastColumn && index === visibleColumns.length - 1,
          minimumColumnWidth,
        }
      )
    );

    if (!tracks.length) {
      return '';
    }

    return [...(prependColumnWidths ?? []), ...tracks].join(' ');
  };

  const commitWidth = (index: number, width: number) => {
    const key = visibleColumns[index]?.key;

    if (onColumnResize) {
      onColumnResize(index, width);
    } else if (key) {
      setInternalWidths(current => ({...current, [key]: width}));
    }
  };

  const {applyTemplate, onResizeEnd, onResizeMove, onResizeStart} = useColumnResize({
    gridRef,
    getResizeTemplate: (index, newWidth) =>
      buildTemplate(index, Math.max(newWidth, minimumColumnWidth)),
    onColumnResizeEnd: (index, newWidth) =>
      commitWidth(index, Math.max(newWidth, minimumColumnWidth)),
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
    columnIndexByKey: new Map(visibleColumns.map((column, index) => [column.key, index])),
    hiddenColumnKeys,
    lastColumnIndex: visibleColumns.length - 1,
    minimumColumnWidth,
    onResetColumnSize: (event, index) => {
      event.stopPropagation();

      applyTemplate(buildTemplate(index, COL_WIDTH_UNDEFINED));
      commitWidth(index, COL_WIDTH_UNDEFINED);
    },
    onResizeEnd,
    onResizeMove,
    onResizeStart,
    resizableByIndex: visibleColumns.map(column => column.resizable !== false),
    tableRef: gridRef,
  };

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

interface CellProps extends ComponentProps<typeof TableCell> {
  columnKey?: string;
}

function Cell({columnKey, ...props}: CellProps) {
  return <TableCell hidden={useIsColumnHidden(columnKey)} role="cell" {...props} />;
}

interface HeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * Identifies the column by position, for callers that render their head cells
   * from an ordered list rather than from a keyed column config.
   */
  columnIndex?: number;
  columnKey?: string;
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
  children,
  columnIndex,
  columnKey,
  onSort,
  overlays,
  ref,
  replace,
  sort,
  to,
  ...props
}: HeadCellProps) {
  const context = useTableContext();
  const index =
    columnIndex ??
    (columnKey === undefined ? undefined : context?.columnIndexByKey.get(columnKey));

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
      hidden={useIsColumnHidden(columnKey)}
      {...props}
      id={cellId}
      ref={getMergedRef(ref)}
      role="columnheader"
    >
      {sortable ? (
        <SortableHeaderCell
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
