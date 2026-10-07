import {useMemo} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

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

import type {GridColumnOrder, GridData} from './types';

export type FromColumnsProps<
  DataRow,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
> = {
  columnOrder: Order[];
  data: DataRow[];
  /**
   * Header cells only offer sorting; the parent component sorts `data` itself.
   */
  grid: GridData<DataRow, Order>;
  'aria-label'?: string;
  bodyStyle?: React.CSSProperties;
  emptyMessage?: React.ReactNode;
  error?: unknown | null;
  fit?: 'max-content';
  height?: CSS['height'];
  highlightedRowKey?: number;
  isLoading?: boolean;
  isRowClickable?: (row: DataRow) => boolean;
  onRowClick?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  onRowMouseOut?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  onRowMouseOver?: (row: DataRow, key: number, event: React.MouseEvent) => void;
  /**
   * @default true
   */
  resizable?: boolean;
  stickyHeader?: boolean;
};

type FromColumnsHeadProps<DataRow, Order extends GridColumnOrder<unknown>> = {
  columnOrder: Order[];
  grid: GridData<DataRow, Order>;
};

function FromColumnsHead<DataRow, Order extends GridColumnOrder<unknown>>({
  columnOrder,
  grid,
}: FromColumnsHeadProps<DataRow, Order>) {
  const prependColumns = grid.renderPrependColumns ? grid.renderPrependColumns(true) : [];

  return (
    <SimpleTable.HeaderRow data-test-id="grid-head-row">
      {prependColumns &&
        columnOrder.length > 0 &&
        prependColumns.map((item, i) => (
          <HeadCellStatic data-test-id="grid-head-cell-static" key={`prepend-${i}`}>
            {item}
          </HeadCellStatic>
        ))}
      {columnOrder.map((column, i) => {
        const columnSort = grid.getColumnSort?.(column, i);

        // Prepended columns have no end padding, so a divider would touch their icons.
        return (
          <SimpleTable.HeaderCell
            align={columnSort?.align}
            columnIndex={i}
            data-test-id="grid-head-cell"
            divider={i === 0 && prependColumns.length > 0 ? false : undefined}
            key={`${i}.${String(column.key)}`}
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

export function FromColumns<
  DataRow extends Record<string, any>,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
>(props: FromColumnsProps<DataRow, Order>) {
  const {
    'aria-label': ariaLabel,
    bodyStyle,
    data,
    error,
    fit,
    grid,
    height,
    highlightedRowKey,
    isLoading,
    isRowClickable,
    onRowClick,
    onRowMouseOut,
    onRowMouseOver,
    resizable = true,
    stickyHeader,
  } = props;

  const columns = useMemo<TableColumnConfig[]>(
    () =>
      props.columnOrder.map(column => {
        const width = grid.staticColumnWidths?.[String(column.key)] ?? column.width;

        return {
          key: String(column.key),
          resizable,
          width:
            fit && (width === undefined || width === COL_WIDTH_UNDEFINED)
              ? `minmax(${fit}, auto)`
              : width,
        };
      }),
    [fit, grid.staticColumnWidths, props.columnOrder, resizable]
  );

  const onColumnResize = (columnIndex: number, width: number) => {
    props.grid.onResizeColumn?.(columnIndex, {
      ...props.columnOrder[columnIndex]!,
      width,
    });
  };

  const renderBody = () => {
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

    return data.map(renderBodyRow);
  };

  const renderBodyRow = (dataRow: DataRow, row: number) => {
    const prependColumns = grid.renderPrependColumns
      ? grid.renderPrependColumns(false, dataRow, row)
      : [];

    return (
      <SimpleTable.Row
        key={row}
        css={isRowClickable?.(dataRow) ? clickableRowStyle : undefined}
        onMouseOver={event => onRowMouseOver?.(dataRow, row, event)}
        onMouseOut={event => onRowMouseOut?.(dataRow, row, event)}
        onClick={event => onRowClick?.(dataRow, row, event)}
        data-test-id="grid-body-row"
      >
        <InteractionStateLayer
          isHovered={row === highlightedRowKey}
          isPressed={false}
          as="td"
        />

        {prependColumns?.map((item, i) => (
          <SimpleTable.RowCell
            {...bodyCellLayout}
            css={bodyCellStaticStyle}
            data-test-id="grid-body-cell"
            key={`prepend-${i}`}
          >
            {item}
          </SimpleTable.RowCell>
        ))}
        {props.columnOrder.map((col, i) => (
          <SimpleTable.RowCell
            {...bodyCellLayout}
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

  return (
    <Profiler id="SimpleTable.FromColumns" onRender={onRenderCallback}>
      <SimpleTable
        aria-label={ariaLabel}
        columns={columns}
        css={tableStyle}
        customSections
        data-test-id="grid-editable"
        maxHeight={height}
        minimumColumnWidth={COL_WIDTH_MINIMUM}
        onColumnResize={grid.onResizeColumn ? onColumnResize : undefined}
        prependColumnWidths={grid.prependColumnWidths}
        scrollable
        style={bodyStyle}
      >
        <SimpleTable.Head sticky={stickyHeader}>
          <FromColumnsHead columnOrder={props.columnOrder} grid={grid} />
        </SimpleTable.Head>
        <SimpleTable.Body>{renderBody()}</SimpleTable.Body>
      </SimpleTable>
    </Profiler>
  );
}

// Grid renderers size their content to the cell, as in right-aligned numbers.
const bodyCellLayout = {
  align: 'stretch',
  direction: 'column',
  justify: 'center',
} as const;

const clickableRowStyle = css`
  cursor: pointer;
`;

const tableStyle = (theme: Theme) => css`
  margin-bottom: ${theme.space.xl};
`;

const HeadCellStatic = styled('th')`
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.xl};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  justify-content: center;

  &:first-child {
    padding: ${p => `${p.theme.space.md} 0 ${p.theme.space.md} ${p.theme.space['2xl']}`};
  }
`;

const bodyCellStaticStyle = (theme: Theme) => css`
  /* The first child is the interaction state layer, so the 2nd is the first cell. */
  &:nth-child(2) {
    padding: ${theme.space.md} 0 ${theme.space.md} ${theme.space['2xl']};
  }
`;
