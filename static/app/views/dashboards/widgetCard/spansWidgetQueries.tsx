import {useCallback, useState} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {
  Confidence,
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {isEventsStats} from 'sentry/views/dashboards/utils/isEventsStats';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {
  convertEventsStatsToTimeSeriesData,
  transformToSeriesMap,
} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
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

type SpansWidgetQueriesImplProps = SpansWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesDataScanned: 'full' | 'partial' | undefined;
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

function SpansWidgetQueries(props: SpansWidgetQueriesProps) {
  const getConfidenceInformation = useCallback(
    (result: SeriesResult) => {
      let seriesConfidence: Confidence | null;
      let seriesSampleCount: number | undefined;
      let seriesIsSampled: boolean | null;
      let seriesDataScanned: 'full' | 'partial' | undefined;

      if (isEventsStats(result)) {
        const [_order, timeSeries] = convertEventsStatsToTimeSeriesData(
          props.widget.queries[0]?.aggregates[0] ?? '',
          result
        );

        seriesConfidence = combineConfidenceForSeries([timeSeries]);

        const {
          dataScanned: calculatedDataScanned,
          sampleCount: calculatedSampleCount,
          isSampled: calculatedIsSampled,
        } = determineSeriesSampleCountAndIsSampled([timeSeries], false);
        seriesDataScanned = calculatedDataScanned;
        seriesSampleCount = calculatedSampleCount;
        seriesIsSampled = calculatedIsSampled;
      } else {
        const dedupedYAxes = dedupeArray(props.widget.queries[0]?.aggregates ?? []);
        const seriesMap = transformToSeriesMap(result, dedupedYAxes);
        const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
        const {
          dataScanned: calculatedDataScanned,
          sampleCount: calculatedSampleCount,
          isSampled: calculatedIsSampled,
        } = determineSeriesSampleCountAndIsSampled(
          series,
          Object.keys(result).some(seriesName => seriesName.toLowerCase() !== 'other')
        );
        seriesDataScanned = calculatedDataScanned;
        seriesSampleCount = calculatedSampleCount;
        seriesConfidence = combineConfidenceForSeries(series);
        seriesIsSampled = calculatedIsSampled;
      }
      return {
        seriesDataScanned,
        seriesConfidence,
        seriesSampleCount,
        seriesIsSampled,
      };
    },
    [props.widget.queries]
  );

  return (
    <SpansWidgetQueriesSingleRequestImpl
      {...props}
      getConfidenceInformation={getConfidenceInformation}
    />
  );
}

function SpansWidgetQueriesSingleRequestImpl({
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
}: SpansWidgetQueriesImplProps) {
  const config = SpansConfig;
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

export default SpansWidgetQueries;
