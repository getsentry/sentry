import type {PageFilters} from 'sentry/types/core';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  WidgetType,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type Props = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
};

function WidgetQueriesWithConfig({
  children,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  selection,
  config,
  widgetInterval,
}: Props & {
  config: any;
}) {
  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config,
    widget,
    samplingMode:
      widget.widgetType === WidgetType.SPANS ? SAMPLING_MODE.NORMAL : undefined,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    selection,
    widgetInterval,
  });

  return children(props);
}

export function WidgetQueries({
  children,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  selection,
  widgetInterval,
}: Props) {
  // Errors and Transactions datasets are the only datasets processed in this component.
  const config = getDatasetConfig(widget.widgetType);

  return (
    <WidgetQueriesWithConfig
      widget={widget}
      dashboardFilters={dashboardFilters}
      cursor={cursor}
      limit={limit}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      selection={selection}
      config={config}
      widgetInterval={widgetInterval}
    >
      {children}
    </WidgetQueriesWithConfig>
  );
}
