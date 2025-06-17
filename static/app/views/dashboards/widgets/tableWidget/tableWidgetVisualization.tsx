import type {CSSProperties} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {type Widget} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {
  renderGridBodyCell,
  renderGridHeaderCell,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetCellRenderers';
import {decodeColumnOrder} from 'sentry/views/discover/utils';

interface TableWidgetVisualizationProps {
  loading: boolean;
  organization: Organization;
  selection: PageFilters;
  tableResults: TableDataWithTitle[];
  widget: Widget;
  fitMaxContent?: boolean;
  minTableColumnWidth?: number;
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
    selection,
    widget,
    stickyHeader,
    minTableColumnWidth,
    style,
  } = props;
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();
  const widths: string[] = [];

  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  const {aggregates, columns} = widget.queries[0]!;

  const fields = defined(widget.queries[0]!.fields)
    ? widget.queries[0]!.fields
    : [...columns, ...aggregates];

  let columnOrder = decodeColumnOrder(
    fields.map(field => ({
      field,
    }))
  );
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
            widget,
            tableData: tableResults?.[0],
            onHeaderClick: () => {},
          }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
          renderBodyCell: renderGridBodyCell({
            ...props,
            location,
            tableData: tableResults?.[0],
            projects,
            eventView,
            theme,
          }),
        }}
        stickyHeader={stickyHeader}
        scrollable
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
