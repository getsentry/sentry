import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {defined} from 'sentry/utils';
import {getSortField} from 'sentry/utils/dashboards/issueFieldRenderers';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Column, ColumnValueType, Sort} from 'sentry/utils/discover/fields';
import {
  fieldAlignment,
  isEquation,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {FieldValueType} from 'sentry/utils/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  TabularColumn,
  TabularData,
  TabularMeta,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import CellAction, {
  Actions,
  copyToClipboard,
} from 'sentry/views/discover/table/cellAction';

export type FieldRendererGetter = (
  field: string,
  data: TabularRow,
  meta: TabularMeta
) => FieldRenderer;

export type FieldRenderer = (
  data: TabularRow,
  baggage: RenderFunctionBaggage
) => React.ReactNode | undefined;

type BaggageMaker = (
  field: string,
  _dataRow: TabularRow,
  meta: TabularMeta
) => RenderFunctionBaggage;

interface TableWidgetVisualizationProps {
  /**
   * The object that contains all the data needed to render the table
   */
  tableData: TabularData;
  /**
   * A mapping between column key to a column alias to override header name.
   */
  aliases?: Record<string, string>;
  /**
   * The cell actions that may appear when a user clicks on a table cell. By default, copying text and opening external links are enabled.
   */
  allowedCellActions?: Actions[];
  /**
   * If supplied, will override the ordering of columns from `tableData`. Can also be used to
   * supply custom display names for columns, column widths and column data type
   */
  columns?: TabularColumn[];
  /**
   * If provided, forces the table to overflow scroll horizontally without requiring column resizing
   * - `max-content`: makes the table expand horizontally to fit the largest content
   */
  fit?: 'max-content';
  /**
   * If true, removes the borders of the sides and bottom of the table
   */
  frameless?: boolean;
  /**
   * A function that returns a field renderer that can be used to render that field given the data and meta. A field renderer is a function that accepts a data row, and a baggage object, and returns a React node or `undefined`, and can be rendered as a table cell.
   * @param fieldName The name of the field to render
   * @param dataRow The full table row of data
   * @param meta The full table metadata
   * @returns `FieldRenderer`
   */
  getRenderer?: FieldRendererGetter;
  /**
   * A function that returns a baggage object that will be passed to all the field renderers during table rendering.
   * @param fieldName The name of the field to render
   * @param dataRow The full table row of data
   * @param meta The full table metadata
   */
  makeBaggage?: BaggageMaker;
  /**
   * A callback function that is invoked after a user clicks a sortable column header. If omitted, clicking a column header updates the sort in the URL
   * @param sort `Sort` object contain the `field` and `kind` ('asc' or 'desc')
   */
  onChangeSort?: (sort: Sort) => void;

  /**
   * A callback function that is invoked after a user resizes a column. If omitted, resizing will update the width parameters in the URL. This function always guarantees width field is supplied, meaning it will fallback to -1
   * @param columns an array of columns with the updated widths
   */
  onResizeColumn?: (columns: TabularColumn[]) => void;
  /**
   * A callback function that is invoked when a user clicks an option in the cell action dropdown.
   */
  onTriggerCellAction?: (
    action: Actions,
    value: string | number,
    dataRow: TabularRow
  ) => void;
  /**
   * If true, will allow table columns to be resized, otherwise no resizing. By default this is true
   */
  resizable?: boolean;
  /**
   * If true, the table will scroll on overflow. Note that the table headers will also be sticky
   */
  scrollable?: boolean;
  /**
   * The current sort order to display
   */
  sort?: Sort;
}

const FRAMELESS_STYLES = {
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  marginBottom: 0,
  borderLeft: 0,
  borderRight: 0,
  borderBottom: 0,
  height: '100%',
};

export function TableWidgetVisualization(props: TableWidgetVisualizationProps) {
  const {
    tableData,
    frameless,
    getRenderer: getRenderer,
    makeBaggage: makeBaggage,
    columns,
    scrollable,
    fit,
    aliases,
    onChangeSort,
    sort,
    onResizeColumn,
    resizable = true,
    onTriggerCellAction,
    allowedCellActions = ALLOWED_CELL_ACTIONS,
  } = props;

  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();

  const getGenericRenderer: FieldRendererGetter = (field, _dataRow, meta) => {
    // NOTE: `alias` is set to `false` here because in almost all endpoints, we don't alias field names anymore. In the past, fields like `"p75(duration)"` would be aliased to `"p75_duration"`, but we don't do that much anymore, so we can safely assume that the field name is the same as the alias.
    return getFieldRenderer(field, meta as MetaType, false);
  };

  const getGenericBaggage: BaggageMaker = (
    field,
    _dataRow,
    meta
  ): RenderFunctionBaggage => {
    const unit = meta.units?.[field] as string | undefined;

    return {
      organization,
      theme,
      location,
      unit,
      projects,
    };
  };

  const {data, meta} = tableData;
  const locationSort = decodeSorts(location?.query?.sort)[0];
  const numColumns = columns?.length ?? Object.keys(meta.fields).length;

  let widths = new Array(numColumns).fill(COL_WIDTH_UNDEFINED);
  const locationWidths = location.query?.width;
  // If at least one column has the width key and that key is defined, take that over url widths
  if (columns?.some(column => defined(column.width))) {
    widths = columns.map(column =>
      defined(column.width) ? column.width : COL_WIDTH_UNDEFINED
    );
  } else if (
    resizable &&
    Array.isArray(locationWidths) &&
    locationWidths.length === numColumns
  ) {
    widths = locationWidths.map(width => {
      const val = parseInt(width, 10);
      return isNaN(val) ? COL_WIDTH_UNDEFINED : val;
    });
  }

  // Fallback to extracting fields from the tableData if no columns are provided
  const columnOrder: TabularColumn[] =
    columns?.map((column, index) => ({
      ...column,
      width: widths[index],
    })) ??
    Object.keys(meta.fields).map((key, index) => ({
      key,
      width: widths[index],
      type: meta.fields[key],
    }));

  return (
    <GridEditable
      data={data}
      // GridEditable needs name, but this functionality is replaced by aliases
      columnOrder={columnOrder.map(column => ({...column, name: column.key}))}
      columnSortBy={[]}
      grid={{
        renderHeadCell: (_tableColumn, columnIndex) => {
          const column = columnOrder[columnIndex]!;
          const align = fieldAlignment(column.key, column.type as ColumnValueType);
          let name = aliases?.[column.key] || column.key;
          if (isEquation(column.key)) name = stripEquationPrefix(name);
          const sortColumn = getSortField(column.key) ?? column.key;

          let direction = undefined;
          if (sort?.field === sortColumn) {
            direction = sort.kind;
          } else if (locationSort?.field === sortColumn && !sort) {
            direction = locationSort.kind;
          }

          return (
            <SortLink
              align={align}
              canSort={column.sortable ?? false}
              title={<StyledTooltip title={name}>{name}</StyledTooltip>}
              onClick={e => {
                if (!onChangeSort) return;
                e.preventDefault();
                const nextDirection = direction === 'desc' ? 'asc' : 'desc';
                onChangeSort({
                  field: sortColumn,
                  kind: nextDirection,
                });
              }}
              direction={direction}
              generateSortLink={() => {
                return {
                  ...location,
                  query: {
                    ...location.query,
                    sort: `${direction === 'desc' ? '' : '-'}${sortColumn}`,
                  },
                };
              }}
            />
          );
        },
        renderBodyCell: (tableColumn, dataRow, rowIndex, columnIndex) => {
          const field = tableColumn.key;

          const valueRenderer = (getRenderer ?? getGenericRenderer)(field, dataRow, meta);
          const baggage = (makeBaggage ?? getGenericBaggage)(field, dataRow, meta);

          const cell = valueRenderer(dataRow, baggage);

          const column = columnOrder[columnIndex]!;
          const formattedColumn = {
            key: column.key,
            name: column.key,
            isSortable: !!column.sortable,
            type: column.type ?? FieldValueType.NEVER,
            column: {
              field: column.key,
              kind: 'field',
            } as Column,
          };

          return (
            <CellAction
              key={`${rowIndex}-${columnIndex}:${tableColumn.name}`}
              column={formattedColumn}
              dataRow={dataRow as TableDataRow}
              handleCellAction={(action: Actions, value: string | number) => {
                onTriggerCellAction?.(action, value, dataRow);
                switch (action) {
                  case Actions.COPY_TO_CLIPBOARD:
                    copyToClipboard(value);
                    break;
                  default:
                    break;
                }
              }}
              allowActions={allowedCellActions}
            >
              {cell}
            </CellAction>
          );
        },
        onResizeColumn: (columnIndex: number, nextColumn: TabularColumn) => {
          widths[columnIndex] = defined(nextColumn.width)
            ? nextColumn.width
            : COL_WIDTH_UNDEFINED;

          columnOrder[columnIndex]!.width = widths[columnIndex];

          if (onResizeColumn) {
            onResizeColumn(columnOrder);
            return;
          }

          // Default is to fallback to location query
          navigate(
            {
              pathname: location.pathname,
              query: {
                ...location.query,
                width: widths,
              },
            },
            {replace: true}
          );
        },
      }}
      stickyHeader={scrollable}
      scrollable={scrollable}
      height={scrollable ? '100%' : undefined}
      bodyStyle={frameless ? FRAMELESS_STYLES : {}}
      fit={fit}
      resizable={resizable}
    />
  );
}

TableWidgetVisualization.LoadingPlaceholder = function ({
  columns,
  aliases,
}: {
  aliases?: Record<string, string>;
  columns?: TabularColumn[];
}) {
  const columnsWithName = columns?.map(column => ({...column, name: column.key})) ?? [];
  return (
    <GridEditable
      isLoading
      columnOrder={columnsWithName}
      columnSortBy={[]}
      data={[]}
      resizable={false}
      grid={{
        renderHeadCell: (_tableColumn, columnIndex) => {
          if (!columns) return null;
          const column = columns[columnIndex]!;
          const align = fieldAlignment(column.key, column.type as ColumnValueType);
          const name = aliases?.[column.key] || column.key;

          return (
            <SortLink
              canSort={false}
              align={align}
              title={<StyledTooltip title={name}>{name}</StyledTooltip>}
              direction={undefined}
              generateSortLink={() => undefined}
            />
          );
        },
      }}
    />
  );
};

const StyledTooltip = styled(Tooltip)`
  display: initial;
  vertical-align: middle;
`;
