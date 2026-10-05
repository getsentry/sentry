import {Fragment, useCallback, useState, type ReactNode} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import {Tooltip} from '@sentry/scraps/tooltip';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumn,
  type GridColumnSort,
} from 'sentry/components/tables/gridEditable';
import {useQueryBasedColumnResize} from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import type {Organization} from 'sentry/types/organization';
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

type Navigate = ReturnType<typeof useNavigate>;

export interface RenderCellOptions {
  columnIndex: number;
  dataRow: TableDataRow;
  field: string;
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
  getValueKey?: (columnKey: string) => string;
  makeQuery?: (
    queryStringObject: ReturnType<EventView['generateQueryStringObject']>
  ) => Location['query'];
  onSort?: (currentSort: Sort | undefined) => void;
  resize?: 'query' | 'state';
}

interface GetColumnSortOptions extends Pick<
  UseEventViewTableOptions,
  'canSort' | 'eventView' | 'location' | 'makeQuery' | 'onSort'
> {
  column: EventViewTableColumn;
  meta: MetaType | undefined;
  sortMeta: MetaType | undefined;
}

function getColumnSort({
  canSort,
  column,
  eventView,
  location,
  makeQuery,
  meta,
  onSort,
  sortMeta,
}: GetColumnSortOptions): GridColumnSort {
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

interface EventViewCellContentProps extends Pick<
  UseEventViewTableOptions,
  'allowActions' | 'getCellActionHandler'
> {
  children: ReactNode;
  column: EventViewTableColumn;
  dataRow: TableDataRow;
  meta: MetaType;
  prefix: ReactNode;
  valueKey: string;
}

function EventViewCellContent({
  allowActions,
  children,
  column,
  dataRow,
  getCellActionHandler,
  meta,
  prefix,
  valueKey,
}: EventViewCellContentProps) {
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

  const value = dataRow[valueKey];
  if (meta[valueKey] === 'integer' && typeof value === 'number' && value > 999) {
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

interface EventViewBodyCellProps extends Pick<
  UseEventViewTableOptions,
  | 'allowActions'
  | 'fieldRendererOptions'
  | 'getCellActionHandler'
  | 'getValueKey'
  | 'location'
  | 'renderCell'
> {
  column: EventViewTableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  meta: MetaType | undefined;
  navigate: Navigate;
  organization: Organization;
  rowIndex: number;
  theme: Theme;
}

function EventViewBodyCell({
  allowActions,
  column,
  columnIndex,
  dataRow,
  fieldRendererOptions,
  getCellActionHandler,
  getValueKey,
  location,
  meta,
  navigate,
  organization,
  renderCell,
  rowIndex,
  theme,
}: EventViewBodyCellProps) {
  if (!meta) {
    return dataRow[column.key];
  }

  const columnKey = String(column.key);
  const valueKey = getValueKey ? getValueKey(columnKey) : columnKey;
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

  return renderCell({
    columnIndex,
    dataRow,
    field: columnKey,
    rendered,
    rowIndex,
    wrap: (children, prefix) => (
      <EventViewCellContent
        allowActions={allowActions}
        column={column}
        dataRow={dataRow}
        getCellActionHandler={getCellActionHandler}
        meta={meta}
        prefix={prefix}
        valueKey={valueKey}
      >
        {children}
      </EventViewCellContent>
    ),
  });
}

function resizeWidths(
  previousWidths: number[],
  columnIndex: number,
  nextColumn: GridColumn
): number[] {
  const updatedWidths = [...previousWidths];
  updatedWidths[columnIndex] = nextColumn.width
    ? Number(nextColumn.width)
    : COL_WIDTH_UNDEFINED;
  return updatedWidths;
}

export function useEventViewTable({
  allowActions,
  canSort,
  eventView,
  fieldRendererOptions,
  filterColumn,
  getCellActionHandler,
  getSortMeta,
  getValueKey,
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

  const handleStateResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumn) => {
      setWidths(previousWidths => resizeWidths(previousWidths, columnIndex, nextColumn));
    },
    []
  );

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

    return {
      getColumnSort: (column: EventViewTableColumn) =>
        getColumnSort({
          canSort,
          column,
          eventView,
          location,
          makeQuery,
          meta,
          onSort,
          sortMeta,
        }),
      onResizeColumn,
      renderBodyCell: (
        column: EventViewTableColumn,
        dataRow: TableDataRow,
        rowIndex: number,
        columnIndex: number
      ) => (
        <EventViewBodyCell
          allowActions={allowActions}
          column={column}
          columnIndex={columnIndex}
          dataRow={dataRow}
          fieldRendererOptions={fieldRendererOptions}
          getCellActionHandler={getCellActionHandler}
          getValueKey={getValueKey}
          location={location}
          meta={meta}
          navigate={navigate}
          organization={organization}
          renderCell={renderCell}
          rowIndex={rowIndex}
          theme={theme}
        />
      ),
    };
  }

  return {columnOrder, getGrid};
}
