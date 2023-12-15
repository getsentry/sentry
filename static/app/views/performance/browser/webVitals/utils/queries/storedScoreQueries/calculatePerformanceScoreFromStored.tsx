import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {
  ProjectScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';

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
  const weight = data[`avg(measurements.score.weight.${webVital})`] as number;
  if (weight > 1) {
    throw new Error(`${webVital} weight should not exceed 1: ${weight}`);
  }
  if (weight < 0) {
    throw new Error(`${webVital} weight should not be less than 0: ${weight}`);
  }
  return weight;
}

function getTotalScore(data: TableDataRow): number {
  return data[`avg(measurements.score.total)`] as number;
}

function hasWebVitalScore(data: TableDataRow, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_scores(measurements.score.${webVital})`)) {
    return (data[`count_scores(measurements.score.${webVital})`] as number) > 0;
  }
  return false;
}

export function getWebVitalScores(data?: TableDataRow): ProjectScore {
  if (!data) {
    return {
      lcpWeight: PERFORMANCE_SCORE_WEIGHTS.lcp,
      fcpWeight: PERFORMANCE_SCORE_WEIGHTS.fcp,
      clsWeight: PERFORMANCE_SCORE_WEIGHTS.cls,
      ttfbWeight: PERFORMANCE_SCORE_WEIGHTS.ttfb,
      fidWeight: PERFORMANCE_SCORE_WEIGHTS.fid,
    };
  }

  const hasLcp = hasWebVitalScore(data, 'lcp');
  const hasFcp = hasWebVitalScore(data, 'fcp');
  const hasCls = hasWebVitalScore(data, 'cls');
  const hasFid = hasWebVitalScore(data, 'fid');
  const hasTtfb = hasWebVitalScore(data, 'ttfb');

  const scores = {
    lcpScore: hasLcp ? Math.round(getWebVitalScore(data, 'lcp') * 100) : undefined,
    fcpScore: hasFcp ? Math.round(getWebVitalScore(data, 'fcp') * 100) : undefined,
    clsScore: hasCls ? Math.round(getWebVitalScore(data, 'cls') * 100) : undefined,
    ttfbScore: hasTtfb ? Math.round(getWebVitalScore(data, 'ttfb') * 100) : undefined,
    fidScore: hasFid ? Math.round(getWebVitalScore(data, 'fid') * 100) : undefined,
    totalScore: Math.round(getTotalScore(data) * 100),
    lcpWeight: Math.round(getWebVitalWeight(data, 'lcp') * 100),
    fcpWeight: Math.round(getWebVitalWeight(data, 'fcp') * 100),
    clsWeight: Math.round(getWebVitalWeight(data, 'cls') * 100),
    ttfbWeight: Math.round(getWebVitalWeight(data, 'ttfb') * 100),
    fidWeight: Math.round(getWebVitalWeight(data, 'fid') * 100),
  };
  return scores;
}
