import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';

function getWebVitalScore(data: TableDataRow, webVital: WebVitals): number {
  return (data[`performance_score(measurements.score.${webVital})`] as number) * 100;
}

function getTotalScore(data: TableDataRow): number {
  return (data[`avg(measurements.score.total)`] as number) * 100;
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

export function getWebVitalScoresFromTableDataRow(data?: TableDataRow): ProjectScore {
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
