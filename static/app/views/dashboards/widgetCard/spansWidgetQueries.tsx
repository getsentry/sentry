import {useCallback, useState} from 'react';

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
import {determineTimeSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
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
  selection?: any;
};

type SpansWidgetQueriesImplProps = SpansWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
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

      if (isEventsStats(result)) {
        const [_order, timeSeries] = convertEventsStatsToTimeSeriesData(
          props.widget.queries[0]?.aggregates[0] ?? '',
          result
        );

        seriesConfidence = determineTimeSeriesConfidence(timeSeries);

        const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
          determineSeriesSampleCountAndIsSampled([timeSeries], false);
        seriesSampleCount = calculatedSampleCount;
        seriesIsSampled = calculatedIsSampled;
      } else {
        const dedupedYAxes = dedupeArray(props.widget.queries[0]?.aggregates ?? []);
        const seriesMap = transformToSeriesMap(result, dedupedYAxes);
        const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
        const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
          determineSeriesSampleCountAndIsSampled(
            series,
            Object.keys(result).some(seriesName => seriesName.toLowerCase() !== 'other')
          );
        seriesSampleCount = calculatedSampleCount;
        seriesConfidence = combineConfidenceForSeries(series);
        seriesIsSampled = calculatedIsSampled;
      }
      return {
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
  selection,
  getConfidenceInformation,
}: SpansWidgetQueriesImplProps) {
  const config = SpansConfig;
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

  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    selection,
    afterFetchSeriesData,
    samplingMode: SAMPLING_MODE.NORMAL,
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

export default SpansWidgetQueries;
