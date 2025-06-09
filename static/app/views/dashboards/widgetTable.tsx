import type {Dispatch, SetStateAction} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import cloneDeep from 'lodash/cloneDeep';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {WidgetViewerQueryField} from 'sentry/components/modals/widgetViewerModal/utils';
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

interface Props {
  loading: boolean;
  organization: Organization;
  renderHeaderGridCell: (
    props: any
  ) => (column: TableColumn<keyof TableDataRow>, _columnIndex: number) => React.ReactNode;
  selection: PageFilters;
  sort: string;
  style: any;
  tableResults: TableDataWithTitle[];
  widget: Widget;
  widths: string[];
  customHeaderClick?: () => void;
  setCurrentWidget?: Dispatch<SetStateAction<Widget>>;
  setWidths?: (w: string[]) => void;
  stickyHeader?: boolean;
  usesLocationQuery?: boolean;
}

export const getColumnSortFromString = (
  sort: string
): Array<TableColumnSort<string | number>> => {
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

export function WidgetTable(props: Props) {
  const {
    tableResults,
    loading,
    customHeaderClick,
    renderHeaderGridCell,
    selection,
    sort,
    widget,
    style,
    usesLocationQuery,
    stickyHeader,
    widths,
    setCurrentWidget,
    setWidths,
  } = props;
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();
  const navigate = useNavigate();
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
    // Editing a widget relies on location query, while state is used in dashboard
    if (usesLocationQuery) {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            [WidgetViewerQueryField.WIDTH]: newWidths,
          },
        },
        {replace: true}
      );
    }
  };

  const onHeaderClick = (newSort?: string) => {
    customHeaderClick?.();
    if (widget.queries[0]) {
      const newWidget = cloneDeep(widget);
      // @ts-expect-error: Object is possibly 'undefined'.
      newWidget.queries[0].orderby = newSort || sort;
      setCurrentWidget?.(newWidget);
    }
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
            isFirstPage: false,
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
      />
    </Fragment>
  );
}
