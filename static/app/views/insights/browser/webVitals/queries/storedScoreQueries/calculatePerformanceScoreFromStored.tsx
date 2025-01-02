import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';

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

function getWebVitalScoreCount(
  data: TableDataRow,
  webVital: WebVitals | 'total'
): number {
  return data[`count_scores(measurements.score.${webVital})`] as number;
}

function hasWebVitalScore(data: TableDataRow, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_scores(measurements.score.${webVital})`)) {
    return getWebVitalScoreCount(data, webVital) > 0;
  }
  return false;
}

export function getWebVitalScores(data?: TableDataRow): ProjectScore {
  if (!data) {
    return {};
  }

  const hasLcp = hasWebVitalScore(data, 'lcp');
  const hasFcp = hasWebVitalScore(data, 'fcp');
  const hasCls = hasWebVitalScore(data, 'cls');
  const hasInp = hasWebVitalScore(data, 'inp');
  const hasTtfb = hasWebVitalScore(data, 'ttfb');

  const scores = {
    lcpScore: hasLcp ? Math.round(getWebVitalScore(data, 'lcp') * 100) : undefined,
    fcpScore: hasFcp ? Math.round(getWebVitalScore(data, 'fcp') * 100) : undefined,
    clsScore: hasCls ? Math.round(getWebVitalScore(data, 'cls') * 100) : undefined,
    ttfbScore: hasTtfb ? Math.round(getWebVitalScore(data, 'ttfb') * 100) : undefined,
    inpScore: hasInp ? Math.round(getWebVitalScore(data, 'inp') * 100) : undefined,
    totalScore: Math.round(getTotalScore(data) * 100),
    ...calculateWeights(data),
  };
  return scores;
}

const calculateWeights = (data: TableDataRow) => {
  const hasLcp = hasWebVitalScore(data, 'lcp');
  const hasFcp = hasWebVitalScore(data, 'fcp');
  const hasCls = hasWebVitalScore(data, 'cls');
  const hasInp = hasWebVitalScore(data, 'inp');
  const hasTtfb = hasWebVitalScore(data, 'ttfb');

  // We need to do this because INP and pageLoads are different score profiles
  const inpScoreCount = getWebVitalScoreCount(data, 'inp') || 0;
  const totalScoreCount = getWebVitalScoreCount(data, 'total');
  const pageLoadCount = totalScoreCount - inpScoreCount;

  const inpWeight = getWebVitalWeight(data, 'inp');
  const inpActualWeight = Math.round(
    ((inpWeight * inpScoreCount) / totalScoreCount) * 100
  );

  const pageLoadWebVitals: WebVitals[] = ['lcp', 'fcp', 'cls', 'ttfb'];
  const [lcpWeight, fcpWeight, clsWeight, ttfbWeight] = pageLoadWebVitals.map(
    webVital => {
      const weight = getWebVitalWeight(data, webVital);
      const actualWeight = Math.round(((weight * pageLoadCount) / totalScoreCount) * 100);
      return actualWeight;
    }
  );
  return {
    lcpWeight: hasLcp ? lcpWeight! : 0,
    fcpWeight: hasFcp ? fcpWeight! : 0,
    clsWeight: hasCls ? clsWeight! : 0,
    ttfbWeight: hasTtfb ? ttfbWeight! : 0,
    inpWeight: hasInp ? inpActualWeight! : 0,
  };
};
