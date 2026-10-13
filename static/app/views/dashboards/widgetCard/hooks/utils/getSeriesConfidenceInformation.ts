import type {
  Confidence,
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {defined} from 'sentry/utils/defined';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  isEventsStats,
  isEventsTimeSeriesResponse,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {
  convertEventsStatsToTimeSeriesData,
  transformToSeriesMap,
} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type SeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats
  | EventsTimeSeriesResponse;

type SeriesConfidenceInformation = {
  confidence: Confidence;
  dataScanned: 'full' | 'partial' | undefined;
  isSampled: boolean | null;
  sampleCount: number | undefined;
};

/**
 * Reads extrapolation confidence and sampling metadata from a series response.
 */
export function getSeriesConfidenceInformation(
  result: SeriesResponse,
  widgetQuery: WidgetQuery | undefined
): SeriesConfidenceInformation {
  if (isEventsTimeSeriesResponse(result)) {
    const series = result.timeSeries;
    const isTopN = (widgetQuery?.columns.length ?? 0) > 0;
    const {dataScanned, sampleCount, isSampled} = determineSeriesSampleCountAndIsSampled(
      series,
      isTopN
    );

    return {
      confidence: combineConfidenceForSeries(series),
      dataScanned,
      isSampled,
      sampleCount,
    };
  }

  if (isEventsStats(result)) {
    const [_order, timeSeries] = convertEventsStatsToTimeSeriesData(
      widgetQuery?.aggregates[0] ?? '',
      result
    );
    const {dataScanned, sampleCount, isSampled} = determineSeriesSampleCountAndIsSampled(
      [timeSeries],
      false
    );

    return {
      confidence: combineConfidenceForSeries([timeSeries]),
      dataScanned,
      isSampled,
      sampleCount,
    };
  }

  const dedupedYAxes = dedupeArray(widgetQuery?.aggregates ?? []);
  const seriesMap = transformToSeriesMap(result, dedupedYAxes);
  const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
  const {dataScanned, sampleCount, isSampled} = determineSeriesSampleCountAndIsSampled(
    series,
    Object.keys(result).some(seriesName => seriesName.toLowerCase() !== 'other')
  );

  return {
    confidence: combineConfidenceForSeries(series),
    dataScanned,
    isSampled,
    sampleCount,
  };
}
