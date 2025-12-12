import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

export function transformPerformanceScoreBreakdownSeries(
  multiSeries: MultiSeriesEventsStats
): MultiSeriesEventsStats {
  const webVitalsThatHaveData: WebVitals[] = ORDER.filter(webVital => {
    const key = `performance_score(measurements.score.${webVital})`;
    const series = multiSeries[key];

    if (!series?.data) return false;

    return series.data.some(([_timestamp, values]) =>
      values.some(v => (v.count || 0) > 0)
    );
  });

  const weights = getWeights(webVitalsThatHaveData);

  const result: MultiSeriesEventsStats = {};

  ORDER.forEach(webVital => {
    const key = `performance_score(measurements.score.${webVital})`;
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
