import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

export const calculatePerformanceScoreFromStoredTableDataRow = (
  data?: TableDataRow
): ProjectScore => {
  const scores = getWebVitalScores(data);
  return scores;
};

function getWebVitalScore(data: TableDataRow, webVital: WebVitals): number {
  return data[`performance_score(measurements.score.${webVital})`] as number;
}

function getWebVitalWeight(data: TableDataRow, webVital: WebVitals): number {
  return data[`avg(measurements.score.weight.${webVital})`] as number;
}

function getTotalScore(data: TableDataRow): number {
  return data[`avg(measurements.score.total)`] as number;
}

export function getWebVitalScores(data?: TableDataRow): ProjectScore {
  if (!data) {
    return {
      lcpScore: null,
      fcpScore: null,
      clsScore: null,
      ttfbScore: null,
      fidScore: null,
      totalScore: null,
    };
  }
  const scores = {
    lcpScore: Math.round(getWebVitalScore(data, 'lcp') * 100),
    fcpScore: Math.round(getWebVitalScore(data, 'fcp') * 100),
    clsScore: Math.round(getWebVitalScore(data, 'cls') * 100),
    ttfbScore: Math.round(getWebVitalScore(data, 'ttfb') * 100),
    fidScore: Math.round(getWebVitalScore(data, 'fid') * 100),
    totalScore: Math.round(getTotalScore(data) * 100),
    lcpWeight: Math.round(getWebVitalWeight(data, 'lcp') * 100),
    fcpWeight: Math.round(getWebVitalWeight(data, 'fcp') * 100),
    clsWeight: Math.round(getWebVitalWeight(data, 'cls') * 100),
    ttfbWeight: Math.round(getWebVitalWeight(data, 'ttfb') * 100),
    fidWeight: Math.round(getWebVitalWeight(data, 'fid') * 100),
  };
  return scores;
}
