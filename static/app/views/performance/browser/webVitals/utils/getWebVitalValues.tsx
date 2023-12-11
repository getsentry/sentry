import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

function hasWebVital(data: TableDataRow, webVital: WebVitals): boolean {
  if (Object.keys(data).includes(`count_web_vitals(measurements.${webVital}, any)`)) {
    return (data[`count_web_vitals(measurements.${webVital}, any)`] as number) > 0;
  }
  return false;
}

function getWebVital(data: TableDataRow, webVital: WebVitals): number {
  return data[`p75(measurements.${webVital})`] as number;
}

export function getWebVitalsFromTableData(data: TableDataRow) {
  const hasLcp = hasWebVital(data, 'lcp');
  const hasFcp = hasWebVital(data, 'fcp');
  const hasCls = hasWebVital(data, 'cls');
  const hasFid = hasWebVital(data, 'fid');
  const hasTtfb = hasWebVital(data, 'ttfb');

  return {
    lcp: hasLcp ? getWebVital(data, 'lcp') : null,
    fcp: hasFcp ? getWebVital(data, 'fcp') : null,
    cls: hasCls ? getWebVital(data, 'cls') : null,
    ttfb: hasTtfb ? getWebVital(data, 'ttfb') : null,
    fid: hasFid ? getWebVital(data, 'fid') : null,
  };
}
