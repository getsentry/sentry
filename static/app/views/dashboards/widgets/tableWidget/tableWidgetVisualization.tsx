import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  renderDefaultBodyCell,
  renderDefaultHeadCell,
} from 'sentry/views/dashboards/widgets/tableWidget/defaultTableCellRenderers';

interface TableWidgetVisualizationProps {
  /**
   * The object that contains all the data needed to render the table
   */
  tableData: TabularData;
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
   * Custom renderer that overrides default for table body cells
   * @param column
   * @param dataRow
   * @param rowIndex
   * @param columnIndex
   * @returns `React.ReactNode | undefined`
   */
  renderTableBodyCell?: (
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode | undefined;
  /**
   * Custom renderer that overrides default for table header cells
   * @param column
   * @param columnIndex
   * @returns `React.ReactNode | undefined`
   */
  renderTableHeadCell?: (
    column: TabularColumn,
    columnIndex: number
  ) => React.ReactNode | undefined;
  /**
   * If true, the table will scroll on overflow. Note that the table headers will also be sticky
   */
  scrollable?: boolean;
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
    renderTableBodyCell,
    renderTableHeadCell,
    columns,
    scrollable,
    fit,
  } = props;

  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

  // Fallback to extracting fields from the tableData if no columns are provided
  const columnOrder: TabularColumn[] =
    columns ??
    Object.keys(tableData?.meta.fields).map((key: string) => ({
      key,
      name: key,
      width: -1,
      type: tableData?.meta.fields[key],
    }));

  return (
    <GridEditable
      data={tableData?.data ?? []}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderHeadCell: renderDefaultHeadCell({renderTableHeadCell}) as (
          column: GridColumnOrder,
          columnIndex: number
        ) => React.ReactNode,
        renderBodyCell: renderDefaultBodyCell({
          tableData,
          location,
          organization,
          theme,
          renderTableBodyCell,
        }),
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
