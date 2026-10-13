import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

export function transformPerformanceScoreBreakdownSeries(
  multiSeries: MultiSeriesEventsStats
): MultiSeriesEventsStats {
  const isEquationFormat = Object.keys(multiSeries).some(key =>
    key.startsWith('equation|')
  );

  const webVitalsThatHaveData: WebVitals[] = ORDER.filter(webVital => {
    const key = isEquationFormat
      ? `equation|performance_score(measurements.score.${webVital})`
      : `performance_score(measurements.score.${webVital})`;
    const series = multiSeries[key];

    if (!series?.data) {
      return false;
    }

    return series.data.some(([_timestamp, values]) =>
      values.some(v => (v.count || 0) > 0)
    );
  });

  const weights = getWeights(webVitalsThatHaveData);

  const result: MultiSeriesEventsStats = {};

  ORDER.forEach(webVital => {
    const key = isEquationFormat
      ? `equation|performance_score(measurements.score.${webVital})`
      : `performance_score(measurements.score.${webVital})`;
    const series = multiSeries[key];

    if (!series?.data) {
      return;
    }

    const transformedSeries: EventsStats = {
      ...series,
      data: series.data.map(([timestamp, values]) => [
        timestamp,
        values.map(v => ({
          ...v,
          count: (v.count ?? 0) * weights[webVital],
        })),
      ]),
    };

    result[key] = transformedSeries;
  });

  return result;
}

export function transformPerformanceScoreBreakdownTimeSeries(
  data: EventsTimeSeriesResponse
): EventsTimeSeriesResponse {
  // Grouped series can't be weighted per web vital, so leave them as they are
  if (data.timeSeries.some(timeSeries => (timeSeries.groupBy?.length ?? 0) > 0)) {
    return data;
  }

  const isEquationFormat = data.timeSeries.some(timeSeries =>
    timeSeries.yAxis.startsWith('equation|')
  );

  const getTimeSeries = (webVital: WebVitals): TimeSeries | undefined => {
    const yAxis = isEquationFormat
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
