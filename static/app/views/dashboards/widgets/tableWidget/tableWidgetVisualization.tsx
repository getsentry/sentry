import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  TabularColumn,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  renderDefaultBodyCell,
  renderDefaultHeadCell,
} from 'sentry/views/dashboards/widgets/tableWidget/defaultTableCellRenderers';

interface TableWidgetVisualizationProps {
  tableData: TabularData;
  /**
   * Applies custom styling for tables that appear in a widget cards
   */
  applyWidgetFrameStyle?: boolean;
  columns?: TabularColumn[];
  fitMaxContent?: 'max-content';
  minTableColumnWidth?: number;
  renderTableBodyCell?: (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode | undefined;
  renderTableHeadCell?: (
    column: GridColumnOrder,
    columnIndex: number
  ) => React.ReactNode | undefined;
  scrollable?: boolean;
  stickyHeader?: boolean;
}

// Used in widget preview and on the dashboard widget frames
const DASHBOARD_TABLE_WIDGET_STYLES = {
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
    stickyHeader,
    scrollable,
    minTableColumnWidth,
    applyWidgetFrameStyle,
    renderTableBodyCell,
    renderTableHeadCell,
    columns,
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
      stickyHeader={stickyHeader}
      scrollable={scrollable}
      height="100%"
      minimumColWidth={minTableColumnWidth}
      bodyStyle={applyWidgetFrameStyle ? DASHBOARD_TABLE_WIDGET_STYLES : {}}
      // TODO: add width resizing
      resizable={false}
    />
  );
}

TableWidgetVisualization.LoadingPlaceholder = function () {
  return (
    <GridEditable isLoading columnOrder={[]} columnSortBy={[]} data={[]} grid={{}} />
  );
};
