import type {PageFilters} from 'sentry/types/core';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats
  | EventsTimeSeriesResponse;
type TableResult = TableData | EventsTableData;

type SpansWidgetQueriesProps = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onBestEffortDataFetched?: () => void;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
};

export function SpansWidgetQueries({
  children,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  selection,
  widgetInterval,
}: SpansWidgetQueriesProps) {
  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config: SpansConfig,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    samplingMode: SAMPLING_MODE.NORMAL,
    selection,
    widgetInterval,
  });

  return getDynamicText({
    value: children(props),
    fixed: <div />,
  });
}
