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
  return data[`avg(measurements.score.${webVital})`] as number;
}
function getWebVitalScoreWeight(data: TableDataRow, webVital: WebVitals): number {
  return data[`avg(measurements.score.weight.${webVital})`] as number;
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
    lcpScore: Math.round(
      getWebVitalScore(data, 'lcp') * getWebVitalScoreWeight(data, 'lcp') * 100
    ),
    fcpScore: Math.round(
      getWebVitalScore(data, 'fcp') * getWebVitalScoreWeight(data, 'fcp') * 100
    ),
    clsScore: Math.round(
      getWebVitalScore(data, 'cls') * getWebVitalScoreWeight(data, 'cls') * 100
    ),
    ttfbScore: Math.round(
      getWebVitalScore(data, 'ttfb') * getWebVitalScoreWeight(data, 'ttfb') * 100
    ),
    fidScore: Math.round(
      getWebVitalScore(data, 'fid') * getWebVitalScoreWeight(data, 'fid') * 100
    ),
  };
  return {...scores, totalScore: Object.values(scores).reduce((a, b) => a + b, 0)};
}
