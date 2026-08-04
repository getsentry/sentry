import type {CSSProperties, ReactNode} from 'react';
import {Fragment, useCallback, useEffect, useRef} from 'react';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {GridEditableEmptyData} from 'sentry/components/tables/gridEditable/GridEditableEmptyData';
import {GridEditableError} from 'sentry/components/tables/gridEditable/GridEditableError';
import {GridEditableLoading} from 'sentry/components/tables/gridEditable/GridEditableLoading';
import {getAriaSort} from 'sentry/components/tables/sortableHeaderCell';
import {useColumnResize} from 'sentry/components/tables/useColumnResize';
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
import type {GridColumnOrder, GridColumnSortBy, GridData} from './types';

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
   * - `columnSortBy` tells each header cell which sort state to announce; the
   *   sort itself is still performed by the parent component
   */
  title?: ReactNode;
};

export function GridEditable<
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

  const refGrid = useRef<HTMLTableElement>(null);

  const buildGridTemplateColumns = useCallback(
    (columnOrder: Order[]) => {
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
      return `${prepend} ${widths.join(' ')}`;
    },
    [minimumColWidth, props.grid.prependColumnWidths]
  );

  const {onResizeMouseDown, applyTemplate} = useColumnResize({
    gridRef: refGrid,
    getResizeTemplate: (columnIndex, newWidth) => {
      const nextColumnOrder = [...props.columnOrder];
      nextColumnOrder[columnIndex] = {
        ...nextColumnOrder[columnIndex]!,
        width: Math.max(newWidth, 0),
      };
      return buildGridTemplateColumns(nextColumnOrder);
    },
    onColumnResizeEnd: (columnIndex, newWidth) => {
      props.grid.onResizeColumn?.(columnIndex, {
        ...props.columnOrder[columnIndex]!,
        width: newWidth,
      });
    },
    writeResizerHeightVar: true,
  });

  const onResetColumnSize = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();

    const nextColumnOrder = [...props.columnOrder];
    nextColumnOrder[i] = {
      ...nextColumnOrder[i]!,
      width: COL_WIDTH_UNDEFINED,
    };
    applyTemplate(buildGridTemplateColumns(nextColumnOrder));

    props.grid.onResizeColumn?.(i, {
      ...nextColumnOrder[i],
      width: COL_WIDTH_UNDEFINED,
    });
  };

  const redrawGridColumn = useCallback(() => {
    applyTemplate(buildGridTemplateColumns(props.columnOrder));
  }, [applyTemplate, buildGridTemplateColumns, props.columnOrder]);

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
              aria-sort={getAriaSort(
                props.columnSortBy.find(sort => sort.key === column.key)?.order
              )}
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
  }, [data, error, redrawGridColumn]);

  useEffect(() => {
    window.addEventListener('resize', redrawGridColumn);

    return () => {
      window.removeEventListener('resize', redrawGridColumn);
    };
  }, [redrawGridColumn]);

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
