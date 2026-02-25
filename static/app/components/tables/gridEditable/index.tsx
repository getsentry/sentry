import type {CSSProperties, ReactNode} from 'react';
import {Fragment, useCallback, useEffect, useRef} from 'react';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {GridEditableEmptyData} from 'sentry/components/tables/gridEditable/GridEditableEmptyData';
import {GridEditableError} from 'sentry/components/tables/gridEditable/GridEditableError';
import {GridEditableLoading} from 'sentry/components/tables/gridEditable/GridEditableLoading';
import {onRenderCallback, Profiler} from 'sentry/utils/performanceForSentry';

import {
  Body,
  Grid,
  GridBody,
  GridBodyCell,
  GridBodyCellStatic,
  GridHead,
  GridHeadCell,
  GridHeadCellStatic,
  GridResizer,
  GridRow,
  Header,
  HeaderButtonContainer,
  HeaderTitle,
} from './styles';
import type {
  ColResizeMetadata,
  GridColumnOrder,
  GridColumnSortBy,
  GridData,
} from './types';

export type * from './types';

// Auto layout width.
export const COL_WIDTH_UNDEFINED = -1;

// Set to 90 as the edit/trash icons need this much space.
export const COL_WIDTH_MINIMUM = 90;

type GridEditableProps<
  DataRow,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
  SortBy extends GridColumnSortBy<unknown> = GridColumnSortBy<keyof DataRow>,
> = {
  columnOrder: Order[];
  columnSortBy: SortBy[];
  data: DataRow[];

  /**
   * GridEditable allows the parent component to determine how to display the
   * data within it. Note that this is optional.
   */
  grid: GridData<DataRow, Order>;
  'aria-label'?: string;
  bodyStyle?: React.CSSProperties;
  emptyMessage?: React.ReactNode;
  error?: unknown | null;

  fit?: 'max-content';
  getRowAriaLabel?: (row: DataRow) => string | undefined;
  /**
   * Inject a set of buttons into the top of the grid table.
   * The controlling component is responsible for handling any actions
   * in these buttons and updating props to the GridEditable instance.
   */
  headerButtons?: () => React.ReactNode;
  height?: CSSProperties['height'];

  highlightedRowKey?: number;

  isLoading?: boolean;

  isRowClickable?: (row: DataRow) => boolean;
  minimumColWidth?: number;
  onRowClick?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  onRowMouseOut?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  onRowMouseOver?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  /**
   * Whether columns in the grid can be resized.
   *
   * @default true
   */
  resizable?: boolean;
  scrollable?: boolean;
  stickyHeader?: boolean;

  /**
   * GridEditable (mostly) do not maintain any internal state and relies on the
   * parent component to tell it how/what to render and will mutate the view
   * based on this 3 main props.
   *
   * - `columnOrder` determines the columns to show, from left to right
   * - `columnSortBy` is not used at the moment, however it might be better to
   *   move sorting into Grid for performance
   */
  title?: ReactNode;
};

export default function GridEditable<
  DataRow extends Record<string, any>,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
  SortBy extends GridColumnSortBy<unknown> = GridColumnSortBy<keyof DataRow>,
>(props: GridEditableProps<DataRow, Order, SortBy>) {
  const {
    'aria-label': ariaLabel,
    bodyStyle,
    data,
    error,
    fit,
    getRowAriaLabel,
    grid,
    headerButtons,
    height,
    highlightedRowKey,
    isLoading,
    isRowClickable,
    minimumColWidth = COL_WIDTH_MINIMUM,
    onRowClick,
    onRowMouseOut,
    onRowMouseOver,
    resizable = true,
    scrollable,
    stickyHeader,
    title,
  } = props;

  const clearWindowLifecycleEvents = useCallback(() => {
    Object.keys(resizeWindowLifecycleEvents.current).forEach(e => {
      resizeWindowLifecycleEvents.current[e]!.forEach(c =>
        window.removeEventListener(e, c)
      );
      resizeWindowLifecycleEvents.current[e] = [];
    });
  }, []);

  const refGrid = useRef<HTMLTableElement>(null);
  const resizeWindowLifecycleEvents = useRef<Record<string, any[]>>({
    mousemove: [],
    mouseup: [],
  });

  const refResizeMetadata = useRef<ColResizeMetadata>(null);

  const onResetColumnSize = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();

    const nextColumnOrder = [...props.columnOrder];
    nextColumnOrder[i] = {
      ...nextColumnOrder[i]!,
      width: COL_WIDTH_UNDEFINED,
    };
    setGridTemplateColumns(nextColumnOrder);

    const onResizeColumn = props.grid.onResizeColumn;
    if (onResizeColumn) {
      onResizeColumn(i, {
        ...nextColumnOrder[i],
        width: COL_WIDTH_UNDEFINED,
      });
    }
  };

  const onResizeMouseDown = (e: React.MouseEvent, i = -1) => {
    e.stopPropagation();

    // Block right-click and other funky stuff
    if (i === -1 || e.type === 'contextmenu') {
      return;
    }

    // <GridResizer> is nested 1 level down from <GridHeadCell>
    const cell = e.currentTarget.parentElement;
    if (!cell) {
      return;
    }

    refResizeMetadata.current = {
      columnIndex: i,
      columnWidth: cell.offsetWidth,
      cursorX: e.clientX,
    };

    window.addEventListener('mousemove', onResizeMouseMove);
    resizeWindowLifecycleEvents.current.mousemove!.push(onResizeMouseMove);

    window.addEventListener('mouseup', onResizeMouseUp);
    resizeWindowLifecycleEvents.current.mouseup!.push(onResizeMouseUp);
  };

  const onResizeMouseUp = (e: MouseEvent) => {
    const metadata = refResizeMetadata.current;
    const onResizeColumn = props.grid.onResizeColumn;

    if (metadata && onResizeColumn) {
      const {columnOrder} = props;
      const widthChange = e.clientX - metadata.cursorX;

      onResizeColumn(metadata.columnIndex, {
        ...columnOrder[metadata.columnIndex]!,
        width: metadata.columnWidth + widthChange,
      });
    }

    refResizeMetadata.current = null;
    clearWindowLifecycleEvents();
  };

  const onResizeMouseMove = (e: MouseEvent) => {
    const {current} = refResizeMetadata;
    if (!current) {
      return;
    }

    window.requestAnimationFrame(() => resizeGridColumn(e, current));
  };

  const resizeGridColumn = (e: MouseEvent, metadata: ColResizeMetadata) => {
    if (!refGrid.current) {
      return;
    }

    const widthChange = e.clientX - metadata.cursorX;

    const nextColumnOrder = [...props.columnOrder];
    nextColumnOrder[metadata.columnIndex] = {
      ...nextColumnOrder[metadata.columnIndex]!,
      width: Math.max(metadata.columnWidth + widthChange, 0),
    };

    setGridTemplateColumns(nextColumnOrder);
  };

  /**
   * Recalculate the dimensions of Grid and Columns and redraws them
   */
  const setGridTemplateColumns = useCallback(
    (columnOrder: Order[]) => {
      if (!refGrid.current) {
        return;
      }

      const prependColumns = props.grid.prependColumnWidths || [];
      const prepend = prependColumns.join(' ');
      const widths = columnOrder.map((item, index) => {
        if (item.width === COL_WIDTH_UNDEFINED) {
          return `minmax(${minimumColWidth}px, auto)`;
        }
        if (typeof item.width === 'number' && item.width > minimumColWidth) {
          if (index === columnOrder.length - 1) {
            return `minmax(${item.width}px, auto)`;
          }
          return `${item.width}px`;
        }
        if (index === columnOrder.length - 1) {
          return `minmax(${minimumColWidth}px, auto)`;
        }
        return `${minimumColWidth}px`;
      });

      // The last column has no resizer and should always be a flexible column
      // to prevent underflows.

      refGrid.current.style.gridTemplateColumns = `${prepend} ${widths.join(' ')}`;

      // Setting the rendered grid height as a CSS variable so `GridResizer` can
      // reliably span the full visible height even when rows grow (e.g. wrapped text).
      refGrid.current.style.setProperty(
        '--grid-editable-resizer-height',
        `${refGrid.current.offsetHeight}px`
      );
    },
    [minimumColWidth, props.grid.prependColumnWidths]
  );

  const redrawGridColumn = useCallback(() => {
    setGridTemplateColumns(props.columnOrder);
  }, [props.columnOrder, setGridTemplateColumns]);

  function renderGridHead() {
    // Ensure that the last column cannot be removed
    const numColumn = props.columnOrder.length;

    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(true)
      : [];

    return (
      <GridRow data-test-id="grid-head-row">
        {prependColumns &&
          props.columnOrder?.length > 0 &&
          prependColumns.map((item, i) => (
            <GridHeadCellStatic data-test-id="grid-head-cell-static" key={`prepend-${i}`}>
              {item}
            </GridHeadCellStatic>
          ))}
        {
          // Note that onResizeMouseDown assumes GridResizer is nested
          // 1 levels under GridHeadCell
          props.columnOrder.map((column, i) => (
            <GridHeadCell
              data-test-id="grid-head-cell"
              key={`${i}.${String(column.key)}`}
              isFirst={i === 0}
            >
              {grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name}
              {i !== numColumn - 1 && resizable && (
                <GridResizer
                  dataRows={!error && !isLoading && data ? data.length : 0}
                  onMouseDown={e => onResizeMouseDown(e, i)}
                  onDoubleClick={e => onResetColumnSize(e, i)}
                  onContextMenu={onResizeMouseDown}
                />
              )}
            </GridHeadCell>
          ))
        }
      </GridRow>
    );
  }

  const renderGridBody = () => {
    if (error) {
      return <GridEditableError />;
    }

    if (isLoading) {
      return <GridEditableLoading />;
    }

    if (!data || data.length === 0) {
      return <GridEditableEmptyData emptyMessage={props.emptyMessage} />;
    }

    return data.map(renderGridBodyRow);
  };

  const renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(false, dataRow, row)
      : [];

    return (
      <GridRow
        key={row}
        onMouseOver={event => onRowMouseOver?.(dataRow, row, event)}
        onMouseOut={event => onRowMouseOut?.(dataRow, row, event)}
        onClick={event => onRowClick?.(dataRow, row, event)}
        data-test-id="grid-body-row"
        isClickable={isRowClickable?.(dataRow)}
        aria-label={getRowAriaLabel?.(dataRow)}
      >
        <InteractionStateLayer
          isHovered={row === highlightedRowKey}
          isPressed={false}
          as="td"
        />

        {prependColumns?.map((item, i) => (
          <GridBodyCellStatic data-test-id="grid-body-cell" key={`prepend-${i}`}>
            {item}
          </GridBodyCellStatic>
        ))}
        {props.columnOrder.map((col, i) => (
          <GridBodyCell data-test-id="grid-body-cell" key={`${String(col.key)}${i}`}>
            {grid.renderBodyCell
              ? grid.renderBodyCell(col, dataRow, row, i)
              : dataRow[col.key as string]}
          </GridBodyCell>
        ))}
      </GridRow>
    );
  };

  useEffect(() => {
    redrawGridColumn();

    window.addEventListener('resize', redrawGridColumn);

    return () => {
      clearWindowLifecycleEvents();
      window.removeEventListener('resize', redrawGridColumn);
    };
  }, [clearWindowLifecycleEvents, redrawGridColumn]);

  const showHeader = title || headerButtons;
  return (
    <Fragment>
      <Profiler id="GridEditable" onRender={onRenderCallback}>
        {showHeader && (
          <Header>
            {title && <HeaderTitle>{title}</HeaderTitle>}
            {headerButtons && (
              <HeaderButtonContainer>{headerButtons()}</HeaderButtonContainer>
            )}
          </Header>
        )}
        <Body style={bodyStyle} showVerticalScrollbar={scrollable}>
          <Grid
            aria-label={ariaLabel}
            data-test-id="grid-editable"
            scrollable={scrollable}
            height={height}
            ref={refGrid}
            fit={fit}
          >
            <GridHead sticky={stickyHeader}>{renderGridHead()}</GridHead>
            <GridBody>{renderGridBody()}</GridBody>
          </Grid>
        </Body>
      </Profiler>
    </Fragment>
  );
}
