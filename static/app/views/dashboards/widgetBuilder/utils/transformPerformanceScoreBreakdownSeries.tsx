import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

function getSpansScoreYAxis(data: EventsTimeSeriesResponse) {
  const isEquationFormat = data.timeSeries.some(timeSeries =>
    timeSeries.yAxis.startsWith('equation|')
  );
  return (webVital: WebVitals) =>
    isEquationFormat
      ? `equation|performance_score(measurements.score.${webVital})`
      : `performance_score(measurements.score.${webVital})`;
}

/**
 * Scales each web vital's 0-1 score by its share of the total performance
 * score, so the stacked chart adds up to the total. `getScoreYAxis` names the
 * series for each vital; it defaults to the spans `performance_score` fields.
 */
export function transformPerformanceScoreBreakdownTimeSeries(
  data: EventsTimeSeriesResponse,
  getScoreYAxis: (webVital: WebVitals) => string = getSpansScoreYAxis(data)
): EventsTimeSeriesResponse {
  // Grouped series can't be weighted per web vital, so leave them as they are
  if (data.timeSeries.some(timeSeries => (timeSeries.groupBy?.length ?? 0) > 0)) {
    return data;
  }

  const getTimeSeries = (webVital: WebVitals): TimeSeries | undefined => {
    const yAxis = getScoreYAxis(webVital);
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
