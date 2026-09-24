import {useCallback, useState} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Confidence} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult = EventsTimeSeriesResponse;
type TableResult = TableData | EventsTableData;

type LogsWidgetQueriesProps = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onBestEffortDataFetched?: () => void;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  selection?: PageFilters;
  widgetInterval?: string;
};

type LogsWidgetQueriesImplProps = LogsWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesDataScanned: 'full' | 'partial' | undefined;
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

export function LogsWidgetQueries(props: LogsWidgetQueriesProps) {
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
    <LogsWidgetQueriesSingleRequestImpl
      {...props}
      getConfidenceInformation={getConfidenceInformation}
    />
  );
}

function LogsWidgetQueriesSingleRequestImpl({
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
}: LogsWidgetQueriesImplProps) {
  const config = LogsConfig;
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
