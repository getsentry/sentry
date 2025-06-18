import type {CSSProperties} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  renderDefaultBodyCell,
  renderDefaultHeadCell,
} from 'sentry/views/dashboards/widgets/tableWidget/defaultTableCellRenderers';
import type {TableColumn} from 'sentry/views/discover/table/types';

interface TableWidgetVisualizationProps {
  columns: Array<TableColumn<string>>;
  loading: boolean;
  tableResults: TableDataWithTitle[];
  fitMaxContent?: boolean;
  minTableColumnWidth?: number;
  renderTableBodyCell?: (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode;
  renderTableHeadCell?: (column: GridColumnOrder, columnIndex: number) => React.ReactNode;
  scrollable?: boolean;
  stickyHeader?: boolean;
  style?: CSSProperties;
}

// Used in widget preview and on the dashboard
export const DASHBOARD_TABLE_WIDGET_STYLES = {
  // Makes the top edges of the table sharp
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  // Removes extra bordering from the table
  marginBottom: 0,
  borderLeft: 0,
  borderRight: 0,
  borderBottom: 0,
  // Get sticky headers to work
  height: '100%',
};

function TableWidgetVisualization(props: TableWidgetVisualizationProps) {
  const {
    tableResults,
    loading,
    stickyHeader,
    scrollable,
    minTableColumnWidth,
    style,
    renderTableBodyCell,
    renderTableHeadCell,
    columns,
  } = props;

  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

  return (
    <Fragment>
      <GridEditable
        isLoading={loading}
        data={tableResults?.[0]?.data ?? []}
        columnOrder={columns}
        columnSortBy={[]}
        grid={{
          renderHeadCell: renderTableHeadCell
            ? renderTableHeadCell
            : (renderDefaultHeadCell({tableData: tableResults?.[0]}) as (
                column: GridColumnOrder,
                columnIndex: number
              ) => React.ReactNode),
          renderBodyCell: renderTableBodyCell
            ? renderTableBodyCell
            : renderDefaultBodyCell({
                tableData: tableResults?.[0],
                location,
                organization,
                theme,
              }),
        }}
        stickyHeader={stickyHeader}
        scrollable={scrollable}
        height={'100%'}
        minimumColWidth={minTableColumnWidth}
        bodyStyle={style}
        // TODO: add width resizing
        resizable={false}
      />
    </Fragment>
  );
}

export default TableWidgetVisualization;
