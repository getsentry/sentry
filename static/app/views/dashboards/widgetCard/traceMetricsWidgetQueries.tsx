import {useCallback, useState} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Confidence} from 'sentry/types/organization';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {
  EMPTY_METRIC_SELECTION,
  TraceMetricsConfig,
} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';

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
};

type TraceMetricsWidgetQueriesImplProps = TraceMetricsWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesDataScanned: 'full' | 'partial';
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

function TraceMetricsWidgetQueries(props: TraceMetricsWidgetQueriesProps) {
  const getConfidenceInformation = useCallback(
    (result: SeriesResult) => {
      const series = result.timeSeries ?? [];
      const isTopN = (props.widget.queries[0]?.columns.length ?? 0) > 0;
      const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopN);

      return {
        seriesDataScanned: samplingMeta.dataScanned,
        seriesConfidence: combineConfidenceForSeries(series),
        seriesSampleCount: samplingMeta.sampleCount,
        seriesIsSampled: samplingMeta.isSampled,
      };
    },
    [props.widget.queries]
  );

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
  widgetInterval,
}: TraceMetricsWidgetQueriesImplProps) {
  const config = TraceMetricsConfig;
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [dataScanned, setDataScanned] = useState<'full' | 'partial' | undefined>(
    undefined
  );
  const [sampleCount, setSampleCount] = useState<number | undefined>(undefined);
  const [isSampled, setIsSampled] = useState<boolean | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    const {seriesDataScanned, seriesConfidence, seriesSampleCount, seriesIsSampled} =
      getConfidenceInformation(result);

    setDataScanned(seriesDataScanned);
    setConfidence(seriesConfidence);
    setSampleCount(seriesSampleCount);
    setIsSampled(seriesIsSampled);
    onDataFetched?.({
      dataScanned: seriesDataScanned,
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
    widgetInterval,
  });

  return getDynamicText({
    value: children({
      ...props,
      dataScanned,
      confidence,
      sampleCount,
      isSampled,
    }),
    fixed: <div />,
  });
}

export default TraceMetricsWidgetQueries;
