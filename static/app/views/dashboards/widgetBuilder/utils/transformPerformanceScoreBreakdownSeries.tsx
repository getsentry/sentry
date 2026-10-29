import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

export function transformPerformanceScoreBreakdownTimeSeries(
  data: EventsTimeSeriesResponse
): EventsTimeSeriesResponse {
  // Grouped series can't be weighted per web vital, so leave them as they are
  if (data.timeSeries.some(timeSeries => (timeSeries.groupBy?.length ?? 0) > 0)) {
    return data;
  }

  const getTimeSeries = (webVital: WebVitals): TimeSeries | undefined =>
    data.timeSeries.find(
      timeSeries =>
        timeSeries.yAxis === `performance_score(measurements.score.${webVital})`
    );

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
