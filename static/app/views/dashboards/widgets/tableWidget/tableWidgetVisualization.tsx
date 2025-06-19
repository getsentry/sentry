import type {CSSProperties} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
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
  tableData: TableData;
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

function TableWidgetVisualization(props: TableWidgetVisualizationProps) {
  const {
    tableData,
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
        data={tableData?.data ?? []}
        columnOrder={columns}
        columnSortBy={[]}
        grid={{
          renderHeadCell: renderTableHeadCell
            ? renderTableHeadCell
            : (renderDefaultHeadCell({tableData}) as (
                column: GridColumnOrder,
                columnIndex: number
              ) => React.ReactNode),
          renderBodyCell: renderTableBodyCell
            ? renderTableBodyCell
            : renderDefaultBodyCell({
                tableData,
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

/** @internal */
export default TableWidgetVisualization;
