import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import type {SpanResponse} from 'sentry/views/insights/types';

type PerformanceScores = Pick<
  SpanResponse,
  | 'performance_score(measurements.score.cls)'
  | 'performance_score(measurements.score.fcp)'
  | 'performance_score(measurements.score.inp)'
  | 'performance_score(measurements.score.lcp)'
  | 'performance_score(measurements.score.ttfb)'
>;

type CountScores = Pick<
  SpanResponse,
  | 'count_scores(measurements.score.cls)'
  | 'count_scores(measurements.score.fcp)'
  | 'count_scores(measurements.score.inp)'
  | 'count_scores(measurements.score.lcp)'
  | 'count_scores(measurements.score.ttfb)'
  | 'count_scores(measurements.score.total)'
>;

type TotalPerformanceScore = {'performance_score(measurements.score.total)': number};

export type WebVitalScores = CountScores & PerformanceScores & TotalPerformanceScore;

function getWebVitalScore(data: PerformanceScores, webVital: WebVitals): number {
  return data[`performance_score(measurements.score.${webVital})`] * 100;
}

function getTotalScore(data: TotalPerformanceScore): number {
  return data[`performance_score(measurements.score.total)`] * 100;
}

function getWebVitalScoreCount(data: CountScores, webVital: WebVitals | 'total'): number {
  return data[`count_scores(measurements.score.${webVital})`];
}

function hasWebVitalScore(data: CountScores, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_scores(measurements.score.${webVital})`)) {
    return getWebVitalScoreCount(data, webVital) > 0;
  }
  return false;
}

export function getWebVitalScoresFromTableDataRow(data?: WebVitalScores): ProjectScore {
  if (!data) {
    return {};
  }

  const [hasLcp, hasFcp, hasCls, hasTtfb, hasInp] = [
    'lcp',
    'fcp',
    'cls',
    'ttfb',
    'inp',
  ].map(webVital => hasWebVitalScore(data, webVital as WebVitals));

  return {
    lcpScore: hasLcp ? Math.round(getWebVitalScore(data, 'lcp')) : undefined,
    fcpScore: hasFcp ? Math.round(getWebVitalScore(data, 'fcp')) : undefined,
    clsScore: hasCls ? Math.round(getWebVitalScore(data, 'cls')) : undefined,
    ttfbScore: hasTtfb ? Math.round(getWebVitalScore(data, 'ttfb')) : undefined,
    inpScore: hasInp ? Math.round(getWebVitalScore(data, 'inp')) : undefined,
    totalScore: Math.round(getTotalScore(data)),
  };
}
