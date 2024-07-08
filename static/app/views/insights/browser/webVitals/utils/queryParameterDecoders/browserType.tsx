import {decodeScalar} from 'sentry/utils/queryString';

// TODO: include both "Google Chrome" and "Chrome" when filtering by Chrome browser
// Taken from: https://github.com/getsentry/relay/blob/ed2fc8c85b2732011e8262f4f598fa2c9857571d/relay-dynamic-config/src/defaults.rs#L146
export enum BrowserType {
  ALL = '',
  CHROME = 'Chrome',
  SAFARI = 'Safari',
  FIREFOX = 'Firefox',
  OPERA = 'Opera',
  EDGE = 'Edge',
  CHROME_MOBILE = 'Chrome Mobile',
  FIREFOX_MOBILE = 'Firefox Mobile',
  // Note that Safari uses "Mobile Safari" instead of "Safari Mobile"
  SAFARI_MOBILE = 'Mobile Safari',
  EDGE_MOBILE = 'Edge Mobile',
  OPERA_MOBILE = 'Opera Mobile',
}
const DEFAULT = BrowserType.ALL;

export default function decode(value: string | string[] | undefined | null): BrowserType {
  const decodedValue = decodeScalar(value, DEFAULT);

  if (isAValidOption(decodedValue)) {
    return decodedValue;
  }

  return DEFAULT;
}

function isAValidOption(maybeOption: string): maybeOption is BrowserType {
  // Manually widen to allow the comparison to string
  return Object.values(BrowserType).includes(maybeOption as BrowserType);
}
