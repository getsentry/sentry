import type {PageFilters} from 'sentry/types/core';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult = EventsTimeSeriesResponse;
type TableResult = EventsTableData;

type TraceMetricsWidgetQueriesProps = {
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
  // Number of buckets for a non-time axis. Used by heat maps for the Y-axis
  // bucket count, derived from the rendered chart height.
  yBuckets?: number;
};

export function TraceMetricsWidgetQueries({
  children,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  selection,
  widgetInterval,
  yBuckets,
}: TraceMetricsWidgetQueriesProps) {
  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config: TraceMetricsConfig,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    samplingMode: SAMPLING_MODE.NORMAL,
    selection,
    widgetInterval,
    yBuckets,
  });

  return children(props);
}
