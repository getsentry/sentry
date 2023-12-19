import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {getWebVitalsFromTableData} from 'sentry/views/performance/browser/webVitals/utils/getWebVitalValues';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/types';

export const PERFORMANCE_SCORE_WEIGHTS = {
  lcp: 30,
  fcp: 15,
  cls: 15,
  fid: 30,
  ttfb: 10,
};

export const PERFORMANCE_SCORE_MEDIANS = {
  lcp: 2400,
  fcp: 1600,
  cls: 0.25,
  fid: 300,
  ttfb: 400,
};

export const PERFORMANCE_SCORE_P90S = {
  lcp: 1200,
  fcp: 900,
  cls: 0.1,
  fid: 100,
  ttfb: 200,
};

export type Vitals = {
  cls?: number;
  fcp?: number;
  fid?: number;
  lcp?: number;
  ttfb?: number;
};

export const calculatePerformanceScoreFromTableDataRow = (
  data?: TableDataRow
): ProjectScore => {
  const webVitals = data ? getWebVitalsFromTableData(data) : {};
  return calculatePerformanceScore(webVitals);
};

export const calculatePerformanceScore = (vitals: Vitals): ProjectScore => {
  const [lcpScore, fcpScore, ttfbScore, clsScore, fidScore] = [
    'lcp',
    'fcp',
    'ttfb',
    'cls',
    'fid',
  ].map(vital => {
    if (vitals[vital] === undefined) {
      return undefined;
    }

    return cdf(
      vitals[vital],
      PERFORMANCE_SCORE_MEDIANS[vital],
      PERFORMANCE_SCORE_P90S[vital]
    );
  });

  // If any of the vitals are null/missing, we need to multiply the total score by
  // a weight multiplier to normalize back to 100
  const weightSum = Object.keys(PERFORMANCE_SCORE_WEIGHTS).reduce(
    (sum, key) =>
      vitals[key] !== undefined ? sum + PERFORMANCE_SCORE_WEIGHTS[key] : sum,
    0
  );
  const weightMultiplier = 100 / weightSum;

  const totalScore =
    ((lcpScore ?? 0) * PERFORMANCE_SCORE_WEIGHTS.lcp +
      (fcpScore ?? 0) * PERFORMANCE_SCORE_WEIGHTS.fcp +
      (ttfbScore ?? 0) * PERFORMANCE_SCORE_WEIGHTS.ttfb +
      (clsScore ?? 0) * PERFORMANCE_SCORE_WEIGHTS.cls +
      (fidScore ?? 0) * PERFORMANCE_SCORE_WEIGHTS.fid) *
    weightMultiplier;

  return {
    totalScore: [lcpScore, fcpScore, ttfbScore, clsScore, fidScore].every(
      score => score === undefined
    )
      ? undefined
      : Math.round(totalScore),
    lcpScore: lcpScore !== undefined ? Math.round(lcpScore * 100) : undefined,
    fcpScore: fcpScore !== undefined ? Math.round(fcpScore * 100) : undefined,
    ttfbScore: ttfbScore !== undefined ? Math.round(ttfbScore * 100) : undefined,
    clsScore: clsScore !== undefined ? Math.round(clsScore * 100) : undefined,
    fidScore: fidScore !== undefined ? Math.round(fidScore * 100) : undefined,
    lcpWeight: PERFORMANCE_SCORE_WEIGHTS.lcp,
    fcpWeight: PERFORMANCE_SCORE_WEIGHTS.fcp,
    ttfbWeight: PERFORMANCE_SCORE_WEIGHTS.ttfb,
    clsWeight: PERFORMANCE_SCORE_WEIGHTS.cls,
    fidWeight: PERFORMANCE_SCORE_WEIGHTS.fid,
  };
};

const cdf = (x, median, p10) => {
  return (
    0.5 *
    (1 - erf((Math.log(x) - Math.log(median)) / (Math.sqrt(2) * sigma(median, p10))))
  );
};

const sigma = (median, p10) => {
  return Math.abs(Math.log(p10) - Math.log(median)) / (Math.sqrt(2) * 0.9061938024368232);
};

// https://hewgill.com/picomath/javascript/erf.js.html
const erf = x => {
  // constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  let sign = 1;
  if (x < 0) {
    sign = -1;
  }
  x = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
};
