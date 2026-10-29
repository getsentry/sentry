import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

/**
 * Scales each web vital's 0-1 score by its weight so the stacked series add up
 * to the total performance score. Only vitals with data are weighted, matching
 * how the backend computes the total. `getScoreYAxis` names the series for each
 * vital; by default they are the spans `performance_score` fields.
 */
export function transformPerformanceScoreBreakdownTimeSeries(
  data: EventsTimeSeriesResponse,
  getScoreYAxis?: (webVital: WebVitals) => string
): EventsTimeSeriesResponse {
  // Grouped series can't be weighted per web vital, so leave them as they are
  if (data.timeSeries.some(timeSeries => (timeSeries.groupBy?.length ?? 0) > 0)) {
    return data;
  }

  const isEquationFormat = data.timeSeries.some(timeSeries =>
    timeSeries.yAxis.startsWith('equation|')
  );

  const getTimeSeries = (webVital: WebVitals): TimeSeries | undefined => {
    const yAxis = getScoreYAxis
      ? getScoreYAxis(webVital)
      : isEquationFormat
        ? `equation|performance_score(measurements.score.${webVital})`
        : `performance_score(measurements.score.${webVital})`;
    return data.timeSeries.find(timeSeries => timeSeries.yAxis === yAxis);
  };

  const webVitalsThatHaveData: WebVitals[] = ORDER.filter(webVital =>
    getTimeSeries(webVital)?.values.some(item => (item.value ?? 0) > 0)
  );

  const weights = getWeights(webVitalsThatHaveData);

  const timeSeries = ORDER.flatMap(webVital => {
    const series = getTimeSeries(webVital);
    if (!series) {
      return [];
    }

    return [
      {
        ...series,
        values: series.values.map(item => ({
          ...item,
          value: (item.value ?? 0) * weights[webVital],
        })),
      },
    ];
  });

  return {...data, timeSeries};
}
