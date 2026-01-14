import {useCallback, useState} from 'react';

import type {Confidence} from 'sentry/types/organization';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  EMPTY_METRIC_SELECTION,
  TraceMetricsConfig,
} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
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
  selection?: any;
};

type TraceMetricsWidgetQueriesImplProps = TraceMetricsWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

function TraceMetricsWidgetQueries(props: TraceMetricsWidgetQueriesProps) {
  const getConfidenceInformation = useCallback(() => {
    // TODO(nar): Implement confidence information parsing
    return {
      seriesConfidence: null,
      seriesSampleCount: undefined,
      seriesIsSampled: null,
    };
  }, []);

  return (
    <TraceMetricsWidgetQueriesSingleRequestImpl
      {...props}
      getConfidenceInformation={getConfidenceInformation}
    />
  );
}

function TraceMetricsWidgetQueriesSingleRequestImpl({
  children,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  getConfidenceInformation,
  selection,
}: TraceMetricsWidgetQueriesImplProps) {
  const config = TraceMetricsConfig;
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [sampleCount, setSampleCount] = useState<number | undefined>(undefined);
  const [isSampled, setIsSampled] = useState<boolean | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    const {seriesConfidence, seriesSampleCount, seriesIsSampled} =
      getConfidenceInformation(result);

    setConfidence(seriesConfidence);
    setSampleCount(seriesSampleCount);
    setIsSampled(seriesIsSampled);
    onDataFetched?.({
      confidence: seriesConfidence,
      sampleCount: seriesSampleCount,
      isSampled: seriesIsSampled,
    });
  };

  // TODO: Handle the "default" empty state better.
  // This is required because metrics loads async and we need to wait for it to load and
  // select a default metric before firing the query.
  const disabled = widget.queries.some(q =>
    q.aggregates.includes(EMPTY_METRIC_SELECTION)
  );

  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    afterFetchSeriesData,
    samplingMode: SAMPLING_MODE.NORMAL,
    disabled,
    loading: disabled,
    selection,
  });

  return getDynamicText({
    value: children({
      ...props,
      confidence,
      sampleCount,
      isSampled,
    }),
    fixed: <div />,
  });
}

export default TraceMetricsWidgetQueries;
