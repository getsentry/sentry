import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';

import type {CSS} from '@sentry/scraps/cssTypes';
import {EmptyState} from '@sentry/scraps/emptyState';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {
  COL_WIDTH_MINIMUM,
  COL_WIDTH_UNDEFINED,
  type TableColumnConfig,
} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {onRenderCallback, Profiler} from 'sentry/utils/performanceForSentry';

import {
  GridBodyCellStatic,
  GridHeadCellStatic,
  Header,
  HeaderButtonContainer,
  HeaderTitle,
} from './styles';
import type {GridColumnOrder, GridData} from './types';

export type * from './types';

export {COL_WIDTH_MINIMUM, COL_WIDTH_UNDEFINED};

type GridEditableProps<
  DataRow,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
> = {
  columnOrder: Order[];
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
  /**
   * Inject a set of buttons into the top of the grid table.
   * The controlling component is responsible for handling any actions
   * in these buttons and updating props to the GridEditable instance.
   */
  headerButtons?: () => React.ReactNode;
  height?: CSS['height'];

  highlightedRowKey?: number;

  isLoading?: boolean;

  isRowClickable?: (row: DataRow) => boolean;
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
   * - `grid.getColumnSort` tells each header cell how to offer sorting and
   *   which direction to announce; the sort itself is still performed by the
   *   parent component
   */
  title?: ReactNode;
};

type GridEditableHeadProps<DataRow, Order extends GridColumnOrder<unknown>> = {
  columnOrder: Order[];
  grid: GridData<DataRow, Order>;
};

function GridEditableHead<DataRow, Order extends GridColumnOrder<unknown>>({
  columnOrder,
  grid,
}: GridEditableHeadProps<DataRow, Order>) {
  const prependColumns = grid.renderPrependColumns ? grid.renderPrependColumns(true) : [];

  return (
    <SimpleTable.HeaderRow data-test-id="grid-head-row">
      {prependColumns &&
        columnOrder.length > 0 &&
        prependColumns.map((item, i) => (
          <GridHeadCellStatic data-test-id="grid-head-cell-static" key={`prepend-${i}`}>
            {item}
          </GridHeadCellStatic>
        ))}
      {columnOrder.map((column, i) => {
        const columnSort = grid.getColumnSort?.(column, i);

        return (
          <SimpleTable.HeaderCell
            align={columnSort?.align}
            columnIndex={i}
            data-test-id="grid-head-cell"
            key={`${i}.${String(column.key)}`}
            isFirst={i === 0}
            handleSortClick={columnSort?.onSort}
            replace={columnSort?.replace}
            sort={columnSort?.direction}
            to={columnSort?.to}
          >
            {grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name}
          </SimpleTable.HeaderCell>
        );
      })}
    </SimpleTable.HeaderRow>
  );
}

export function GridEditable<
  DataRow extends Record<string, any>,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
>(props: GridEditableProps<DataRow, Order>) {
  const {
    'aria-label': ariaLabel,
    bodyStyle,
    data,
    error,
    fit,
    grid,
    headerButtons,
    height,
    highlightedRowKey,
    isLoading,
    isRowClickable,
    onRowClick,
    onRowMouseOut,
    onRowMouseOver,
    resizable = true,
    scrollable,
    stickyHeader,
    title,
  } = props;

  const columns = useMemo<TableColumnConfig[]>(
    () =>
      props.columnOrder.map(column => ({
        key: String(column.key),
        resizable,
        width: grid.staticColumnWidths?.[String(column.key)] ?? column.width,
      })),
    [grid.staticColumnWidths, props.columnOrder, resizable]
  );

  const onColumnResize = (columnIndex: number, width: number) => {
    props.grid.onResizeColumn?.(columnIndex, {
      ...props.columnOrder[columnIndex]!,
      width,
    });
  };

  const renderGridBody = () => {
    if (error) {
      return <SimpleTable.Error />;
    }

    if (isLoading) {
      return <SimpleTable.Loading />;
    }

    if (!data || data.length === 0) {
      return (
        <SimpleTable.Empty>
          {props.emptyMessage ?? (
            <EmptyState title={t('No results found for your query')} />
          )}
        </SimpleTable.Empty>
      );
    }

    return data.map(renderGridBodyRow);
  };

  const renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(false, dataRow, row)
      : [];

    return (
      <SimpleTable.Row
        key={row}
        onMouseOver={event => onRowMouseOver?.(dataRow, row, event)}
        onMouseOut={event => onRowMouseOut?.(dataRow, row, event)}
        onClick={event => onRowClick?.(dataRow, row, event)}
        data-test-id="grid-body-row"
        isClickable={isRowClickable?.(dataRow)}
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
          <SimpleTable.RowCell
            data-test-id="grid-body-cell"
            key={`${String(col.key)}${i}`}
          >
            {grid.renderBodyCell
              ? grid.renderBodyCell(col, dataRow, row, i)
              : dataRow[col.key as string]}
          </SimpleTable.RowCell>
        ))}
      </SimpleTable.Row>
    );
  };

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
        <SimpleTable
          variant="results"
          aria-label={ariaLabel}
          columns={columns}
          customSections
          data-test-id="grid-editable"
          fit={fit}
          flexibleLastColumn
          height={height}
          minimumColumnWidth={COL_WIDTH_MINIMUM}
          onColumnResize={grid.onResizeColumn ? onColumnResize : undefined}
          prependColumnWidths={grid.prependColumnWidths}
          scrollable={scrollable}
          showVerticalScrollbar={scrollable}
          style={bodyStyle}
        >
          <SimpleTable.Head sticky={stickyHeader}>
            <GridEditableHead columnOrder={props.columnOrder} grid={grid} />
          </SimpleTable.Head>
          <SimpleTable.Body>{renderGridBody()}</SimpleTable.Body>
        </SimpleTable>
      </Profiler>
    </Fragment>
  );
}
