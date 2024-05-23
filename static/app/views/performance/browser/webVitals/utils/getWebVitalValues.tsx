import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {Vitals} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import type {WebVitalsAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';

function hasWebVital(data: TableDataRow, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_web_vitals(measurements.${webVital}, any)`)) {
    return (data[`count_web_vitals(measurements.${webVital}, any)`] as number) > 0;
  }
  return false;
}

function getWebVital(
  data: TableDataRow,
  webVital: WebVitals,
  aggregateFunction: WebVitalsAggregateFunction
): number {
  return data[`${aggregateFunction}(measurements.${webVital})`] as number;
}

export function getWebVitalsFromTableData(
  data: TableDataRow,
  aggregateFunction: WebVitalsAggregateFunction
): Vitals {
  const hasLcp = hasWebVital(data, 'lcp');
  const hasFcp = hasWebVital(data, 'fcp');
  const hasCls = hasWebVital(data, 'cls');
  const hasFid = hasWebVital(data, 'fid');
  const hasTtfb = hasWebVital(data, 'ttfb');

  return {
    lcp: hasLcp ? getWebVital(data, 'lcp', aggregateFunction) : undefined,
    fcp: hasFcp ? getWebVital(data, 'fcp', aggregateFunction) : undefined,
    cls: hasCls ? getWebVital(data, 'cls', aggregateFunction) : undefined,
    ttfb: hasTtfb ? getWebVital(data, 'ttfb', aggregateFunction) : undefined,
    fid: hasFid ? getWebVital(data, 'fid', aggregateFunction) : undefined,
  };
}
