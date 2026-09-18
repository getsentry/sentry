import {Fragment, useState, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Tooltip} from '@sentry/scraps/tooltip';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumn,
  type GridColumnSort,
} from 'sentry/components/tables/gridEditable';
import {useQueryBasedColumnResize} from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  isFieldSortable,
  type EventView,
  type MetaType,
} from 'sentry/utils/discover/eventView';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, type Sort} from 'sentry/utils/discover/fields';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CellAction, type Actions} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';

type EventViewTableColumn = TableColumn<keyof TableDataRow>;

type CellActionHandler = (action: Actions, value: string | number) => void;

export interface RenderCellOptions {
  column: EventViewTableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rendered: ReactNode;
  rowIndex: number;
  wrap: (children: ReactNode, prefix?: ReactNode) => ReactNode;
}

interface UseEventViewTableOptions {
  eventView: EventView;
  getCellActionHandler: (
    column: EventViewTableColumn,
    dataRow: TableDataRow
  ) => CellActionHandler;
  location: Location;
  renderCell: (options: RenderCellOptions) => ReactNode;
  allowActions?: Actions[];
  canSort?: (column: EventViewTableColumn) => boolean;
  fieldRendererOptions?: Partial<RenderFunctionBaggage>;
  filterColumn?: (column: TableColumn<string>) => boolean;
  getSortMeta?: (meta: MetaType | undefined) => MetaType | undefined;
  makeQuery?: (
    queryStringObject: ReturnType<EventView['generateQueryStringObject']>
  ) => Location['query'];
  onSort?: (currentSort: Sort | undefined) => void;
  resize?: 'query' | 'state';
}

export function useEventViewTable({
  allowActions,
  canSort,
  eventView,
  fieldRendererOptions,
  filterColumn,
  getCellActionHandler,
  getSortMeta,
  location,
  makeQuery,
  onSort,
  renderCell,
  resize,
}: UseEventViewTableOptions) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const theme = useTheme();
  const [widths, setWidths] = useState<number[]>([]);

  const eventViewColumns = eventView.getColumns();
  const filteredColumns = filterColumn
    ? eventViewColumns.filter(filterColumn)
    : eventViewColumns;

  const queryResize = useQueryBasedColumnResize({columns: filteredColumns});

  const stateColumns = filteredColumns.map((column, index) =>
    typeof widths[index] === 'number' ? {...column, width: widths[index]} : column
  );

  function handleStateResizeColumn(columnIndex: number, nextColumn: GridColumn) {
    setWidths(previousWidths => {
      const updatedWidths = [...previousWidths];
      updatedWidths[columnIndex] = nextColumn.width
        ? Number(nextColumn.width)
        : COL_WIDTH_UNDEFINED;
      return updatedWidths;
    });
  }

  const {columnOrder, onResizeColumn} =
    resize === 'query'
      ? {
          columnOrder: queryResize.columns,
          onResizeColumn: queryResize.handleResizeColumn,
        }
      : resize === 'state'
        ? {columnOrder: stateColumns, onResizeColumn: handleStateResizeColumn}
        : {columnOrder: filteredColumns, onResizeColumn: undefined};

  function getGrid(meta: MetaType | undefined) {
    const sortMeta = getSortMeta ? getSortMeta(meta) : meta;

    function getColumnSort(column: EventViewTableColumn): GridColumnSort {
      const align = fieldAlignment(column.name, column.type, meta);
      const field = {field: String(column.key), width: column.width};

      if (!sortMeta || canSort?.(column) === false || !isFieldSortable(field, sortMeta)) {
        return {align};
      }

      const currentSort = eventView.sortForField(field, sortMeta);
      const queryStringObject = eventView
        .sortOnField(field, sortMeta)
        .generateQueryStringObject();

      return {
        align,
        direction: currentSort?.kind,
        onSort: onSort && (() => onSort(currentSort)),
        to: {
          ...location,
          query: makeQuery?.(queryStringObject) ?? {
            ...location.query,
            sort: queryStringObject.sort,
          },
        },
      };
    }

    function renderBodyCell(
      column: EventViewTableColumn,
      dataRow: TableDataRow,
      rowIndex: number,
      columnIndex: number
    ): ReactNode {
      if (!meta) {
        return dataRow[column.key];
      }

      const columnKey = String(column.key);
      const rendered = getFieldRenderer(
        columnKey,
        meta,
        false
      )(dataRow, {
        location,
        navigate,
        organization,
        theme,
        unit: meta.units?.[columnKey],
        ...fieldRendererOptions,
      });

      function wrap(children: ReactNode, prefix?: ReactNode) {
        const content = (
          <Fragment>
            {prefix}
            <CellAction
              column={column}
              dataRow={dataRow}
              handleCellAction={getCellActionHandler(column, dataRow)}
              allowActions={allowActions}
            >
              {children}
            </CellAction>
          </Fragment>
        );

        const value = dataRow[columnKey];
        if (meta?.[columnKey] === 'integer' && typeof value === 'number' && value > 999) {
          return (
            <Tooltip
              title={value.toLocaleString()}
              containerDisplayMode="block"
              position="right"
            >
              {content}
            </Tooltip>
          );
        }

        return content;
      }

      return renderCell({column, columnIndex, dataRow, rendered, rowIndex, wrap});
    }

    return {getColumnSort, onResizeColumn, renderBodyCell};
  }

  return {columnOrder, getGrid};
}
