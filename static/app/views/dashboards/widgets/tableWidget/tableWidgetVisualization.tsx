import type {CSSProperties} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {
  renderGridBodyCell,
  renderGridHeaderCell,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetCellRenderers';
import {decodeColumnOrder} from 'sentry/views/discover/utils';

interface TableWidgetVisualizationProps {
  eventView: EventView;
  loading: boolean;
  tableResults: TableDataWithTitle[];
  fitMaxContent?: boolean;
  minTableColumnWidth?: number;
  scrollable?: boolean;
  stickyHeader?: boolean;
  style?: CSSProperties;
  widget?: Widget;
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
    eventView,
    widget,
    stickyHeader,
    scrollable,
    minTableColumnWidth,
    style,
  } = props;
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const widths: string[] = [];

  const tableWidget: Widget = {
    displayType: DisplayType.TABLE,
    ...widget,
    queries: [],
    title: tableResults?.[0]?.title || '',
    interval: '',
  };

  let columnOrder = decodeColumnOrder(eventView.fields);
  columnOrder = columnOrder.map((column, index) => ({
    ...column,
    width: parseInt(widths[index] || '-1', 10),
  }));

  return (
    <Fragment>
      <GridEditable
        isLoading={loading}
        data={tableResults?.[0]?.data ?? []}
        columnOrder={columnOrder}
        columnSortBy={[]}
        grid={{
          renderHeadCell: renderGridHeaderCell({
            ...props,
            tableData: tableResults?.[0],
            onHeaderClick: () => {},
            widget: tableWidget,
          }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
          renderBodyCell: renderGridBodyCell({
            ...props,
            location,
            tableData: tableResults?.[0],
            projects,
            eventView,
            theme,
            organization,
            widget: tableWidget,
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
