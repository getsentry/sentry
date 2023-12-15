import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {Vitals} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

function hasWebVital(data: TableDataRow, webVital: WebVitals): boolean {
  if (data.hasOwnProperty(`count_web_vitals(measurements.${webVital}, any)`)) {
    return (data[`count_web_vitals(measurements.${webVital}, any)`] as number) > 0;
  }
  return false;
}

function getWebVital(data: TableDataRow, webVital: WebVitals): number {
  return data[`p75(measurements.${webVital})`] as number;
}

export function getWebVitalsFromTableData(data: TableDataRow): Vitals {
  const hasLcp = hasWebVital(data, 'lcp');
  const hasFcp = hasWebVital(data, 'fcp');
  const hasCls = hasWebVital(data, 'cls');
  const hasFid = hasWebVital(data, 'fid');
  const hasTtfb = hasWebVital(data, 'ttfb');

  return {
    lcp: hasLcp ? getWebVital(data, 'lcp') : undefined,
    fcp: hasFcp ? getWebVital(data, 'fcp') : undefined,
    cls: hasCls ? getWebVital(data, 'cls') : undefined,
    ttfb: hasTtfb ? getWebVital(data, 'ttfb') : undefined,
    fid: hasFid ? getWebVital(data, 'fid') : undefined,
  };
}
