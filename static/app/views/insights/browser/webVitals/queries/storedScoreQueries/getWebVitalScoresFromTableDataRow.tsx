import type {WebVitalsRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';

type Data = Pick<
  WebVitalsRow,
  | 'performance_score(measurements.score.cls)'
  | 'performance_score(measurements.score.fcp)'
  | 'performance_score(measurements.score.inp)'
  | 'performance_score(measurements.score.lcp)'
  | 'performance_score(measurements.score.ttfb)'
  | 'avg(measurements.score.total)'
  | 'count_scores(measurements.score.cls)'
  | 'count_scores(measurements.score.fcp)'
  | 'count_scores(measurements.score.inp)'
  | 'count_scores(measurements.score.lcp)'
  | 'count_scores(measurements.score.ttfb)'
  | 'count_scores(measurements.score.total)'
>;

function getWebVitalScore(data: Data, webVital: WebVitals): number {
  return (data[`performance_score(measurements.score.${webVital})`] as number) * 100;
}

function getTotalScore(data: Data): number {
  return (data[`avg(measurements.score.total)`] as number) * 100;
}

function getWebVitalScoreCount(data: Data, webVital: WebVitals | 'total'): number {
  return data[`count_scores(measurements.score.${webVital})`] as number;
}

function hasWebVitalScore(data: Data, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_scores(measurements.score.${webVital})`)) {
    return getWebVitalScoreCount(data, webVital) > 0;
  }
  return false;
}

export function getWebVitalScoresFromTableDataRow(data?: WebVitalsRow): ProjectScore {
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
