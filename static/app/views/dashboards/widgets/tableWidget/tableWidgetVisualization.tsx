import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import GridEditable from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {getSortField} from 'sentry/utils/dashboards/issueFieldRenderers';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnValueType, Sort} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  TabularColumn,
  TabularData,
  TabularMeta,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';

type FieldRendererGetter = (
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
  } = props;

  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

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
    };
  };

  // Fallback to extracting fields from the tableData if no columns are provided
  const columnOrder: TabularColumn[] =
    columns ??
    Object.keys(tableData?.meta.fields).map((key: string) => ({
      key,
      name: key,
      width: -1,
      type: tableData?.meta.fields[key],
    }));

  const {data, meta} = tableData;
  const locationSort = decodeSorts(location?.query?.sort)[0];

  return (
    <GridEditable
      data={data}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderHeadCell: (_tableColumn, columnIndex) => {
          const column = columnOrder[columnIndex]!;
          const align = fieldAlignment(column.name, column.type as ColumnValueType);
          const name = aliases?.[column.key] || column.name;
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
              onClick={() => {
                const nextDirection = direction === 'desc' ? 'asc' : 'desc';

                onChangeSort?.({
                  field: sortColumn,
                  kind: nextDirection,
                });
              }}
              title={<StyledTooltip title={name}>{name}</StyledTooltip>}
              direction={direction}
              generateSortLink={() => {
                return onChangeSort
                  ? location
                  : {
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

          return <div key={`${rowIndex}-${columnIndex}:${tableColumn.name}`}>{cell}</div>;
        },
      }}
      stickyHeader={scrollable}
      scrollable={scrollable}
      height={scrollable ? '100%' : undefined}
      bodyStyle={frameless ? FRAMELESS_STYLES : {}}
      // Resizing is not implemented yet
      resizable={false}
      fit={fit}
    />
  );
}

TableWidgetVisualization.LoadingPlaceholder = function () {
  return (
    <GridEditable isLoading columnOrder={[]} columnSortBy={[]} data={[]} grid={{}} />
  );
};

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;
