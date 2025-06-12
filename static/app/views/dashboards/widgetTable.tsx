import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {renderGridBodyCell} from 'sentry/components/modals/widgetViewerModal/widgetViewerTableCell';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {type Widget} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {useDashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import type {TableColumn, TableColumnSort} from 'sentry/views/discover/table/types';
import {decodeColumnOrder} from 'sentry/views/discover/utils';

interface WidgetTableProps {
  loading: boolean;
  organization: Organization;
  renderHeaderGridCell: (
    props: any
  ) => (column: TableColumn<keyof TableDataRow>, _columnIndex: number) => React.ReactNode;
  selection: PageFilters;
  sort: string;
  tableResults: TableDataWithTitle[];
  widget: Widget;
  widths: string[];
  customHeaderClick?: () => void;
  fitMaxContent?: boolean;
  isFirstPage?: boolean;
  minColumnWidth?: number;
  setWidgetSort?: (ns: string) => void;
  setWidths?: (w: string[]) => void;
  stickyHeader?: boolean;
  style?: any;
  usesLocationQuery?: boolean;
}

export const getColumnSortFromString = (sort: string): Array<TableColumnSort<string>> => {
  if (sort.length < 1) return [];
  if (sort.startsWith('-'))
    return [
      {
        key: sort.substring(1),
        order: 'desc',
      },
    ];
  return [
    {
      key: sort,
      order: 'asc',
    },
  ];
};

export function WidgetTable(props: WidgetTableProps) {
  const {
    tableResults,
    loading,
    customHeaderClick,
    renderHeaderGridCell,
    selection,
    sort,
    widget,
    style,
    usesLocationQuery = false,
    stickyHeader,
    widths,
    setWidgetSort,
    setWidths,
    minColumnWidth,
    isFirstPage,
    fitMaxContent,
  } = props;
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {projects} = useProjects();
  const {isMetricsData} = useDashboardsMEPContext();

  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  const columnSortBy = usesLocationQuery
    ? eventView.getSorts()
    : getColumnSortFromString(sort);

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

  const onResizeColumn = (columnIndex: number, nextColumn: GridColumnOrder) => {
    const newWidth = nextColumn.width ? Number(nextColumn.width) : COL_WIDTH_UNDEFINED;
    const newWidths: number[] = new Array(Math.max(columnIndex, widths.length)).fill(
      COL_WIDTH_UNDEFINED
    );
    widths.forEach((width, index) => (newWidths[index] = parseInt(width, 10)));
    newWidths[columnIndex] = newWidth;
    setWidths?.(newWidths.map(String));
    // Some use cases rely on state.
    // Ex. modal viewer widget table uses location query, while state is used when
    // there are multiple widgets on the dashboard
    if (usesLocationQuery) {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            width: newWidths,
          },
        },
        {replace: true}
      );
    }
  };

  const onHeaderClick = (newSort?: string) => {
    customHeaderClick?.();
    // To trigger a rerender when relying on widget state
    setWidgetSort?.(newSort || '');
  };

  return (
    <Fragment>
      <GridEditable
        isLoading={loading}
        data={tableResults?.[0]?.data ?? []}
        columnOrder={columnOrder}
        columnSortBy={columnSortBy}
        grid={{
          renderHeadCell: renderHeaderGridCell({
            ...props,
            location,
            widget,
            tableData: tableResults?.[0],
            theme,
            sort,
            onHeaderClick,
            usesLocationQuery,
          }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
          renderBodyCell: renderGridBodyCell({
            ...props,
            location,
            tableData: tableResults?.[0],
            isFirstPage,
            projects,
            eventView,
            theme,
            isMetricsData,
          }),
          onResizeColumn,
        }}
        bodyStyle={style}
        stickyHeader={stickyHeader}
        scrollable
        height={'100%'}
        minimumColWidth={minColumnWidth}
        fitMaxContent={fitMaxContent}
      />
    </Fragment>
  );
}
