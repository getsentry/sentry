import type {CSSProperties, ReactNode} from 'react';
import {Fragment, useMemo} from 'react';

import {EmptyState} from '@sentry/scraps/emptyState';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {
  COL_WIDTH_MINIMUM,
  COL_WIDTH_UNDEFINED,
  Table,
  type TableColumnConfig,
} from '@sentry/scraps/table';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DataTable} from 'sentry/components/tables/dataTable';
import {getAriaSort} from 'sentry/components/tables/sortableHeaderCell';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {onRenderCallback, Profiler} from 'sentry/utils/performanceForSentry';

import {
  GridBodyCellStatic,
  GridHeadCellStatic,
  Header,
  HeaderButtonContainer,
  HeaderTitle,
} from './styles';
import type {GridColumnOrder, GridColumnSortBy, GridData} from './types';

export type * from './types';

export {COL_WIDTH_MINIMUM, COL_WIDTH_UNDEFINED};

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
        width: column.width,
      })),
    [props.columnOrder, resizable]
  );

  const onColumnResize = (columnIndex: number, width: number) => {
    props.grid.onResizeColumn?.(columnIndex, {
      ...props.columnOrder[columnIndex]!,
      width,
    });
  };

  function renderGridHead() {
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(true)
      : [];

    return (
      <DataTable.Row data-test-id="grid-head-row">
        {prependColumns &&
          props.columnOrder?.length > 0 &&
          prependColumns.map((item, i) => (
            <GridHeadCellStatic data-test-id="grid-head-cell-static" key={`prepend-${i}`}>
              {item}
            </GridHeadCellStatic>
          ))}
        {props.columnOrder.map((column, i) => (
          <DataTable.HeadCell
            aria-sort={getAriaSort(
              props.columnSortBy.find(sort => sort.key === column.key)?.order
            )}
            columnIndex={i}
            data-test-id="grid-head-cell"
            key={`${i}.${String(column.key)}`}
            isFirst={i === 0}
          >
            {grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name}
          </DataTable.HeadCell>
        ))}
      </DataTable.Row>
    );
  }

  const renderGridBody = () => {
    if (error) {
      return (
        <DataTable.Status>
          <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
        </DataTable.Status>
      );
    }

    if (isLoading) {
      return (
        <DataTable.Status>
          <LoadingIndicator />
        </DataTable.Status>
      );
    }

    if (!data || data.length === 0) {
      return (
        <DataTable.Status>
          {props.emptyMessage ?? (
            <EmptyState title={t('No results found for your query')} />
          )}
        </DataTable.Status>
      );
    }

    return data.map(renderGridBodyRow);
  };

  const renderGridBodyRow = (dataRow: DataRow, row: number) => {
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(false, dataRow, row)
      : [];

    return (
      <DataTable.Row
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
          <DataTable.Cell data-test-id="grid-body-cell" key={`${String(col.key)}${i}`}>
            {grid.renderBodyCell
              ? grid.renderBodyCell(col, dataRow, row, i)
              : dataRow[col.key as string]}
          </DataTable.Cell>
        ))}
      </DataTable.Row>
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
        <DataTable.Frame style={bodyStyle} showVerticalScrollbar={scrollable}>
          <DataTable.Grid
            aria-label={ariaLabel}
            columns={columns}
            data-test-id="grid-editable"
            fit={fit}
            height={height}
            minimumColumnWidth={COL_WIDTH_MINIMUM}
            onColumnResize={grid.onResizeColumn ? onColumnResize : undefined}
            prependColumnWidths={grid.prependColumnWidths}
            scrollable={scrollable}
          >
            <DataTable.Head sticky={stickyHeader}>{renderGridHead()}</DataTable.Head>
            <Table.Body>{renderGridBody()}</Table.Body>
          </DataTable.Grid>
        </DataTable.Frame>
      </Profiler>
    </Fragment>
  );
}
