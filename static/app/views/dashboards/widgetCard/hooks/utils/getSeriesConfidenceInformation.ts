import type {Confidence} from 'sentry/types/organization';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';

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
  result: EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery | undefined
): SeriesConfidenceInformation {
  const series = result.timeSeries ?? [];
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
