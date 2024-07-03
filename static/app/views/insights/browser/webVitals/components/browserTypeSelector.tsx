import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanIndexedField} from 'sentry/views/insights/types';

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

const browserOptions = [
  {value: '', label: t('All')},
  {value: BrowserType.CHROME, label: t('Chrome')},
  {value: BrowserType.SAFARI, label: t('Safari')},
  {value: BrowserType.FIREFOX, label: t('Firefox')},
  {value: BrowserType.OPERA, label: t('Opera')},
  {value: BrowserType.EDGE, label: t('Edge')},
  {value: BrowserType.CHROME_MOBILE, label: t('Chrome Mobile')},
  {value: BrowserType.FIREFOX_MOBILE, label: t('Firefox Mobile')},
  {value: BrowserType.SAFARI_MOBILE, label: t('Safari Mobile')},
  {value: BrowserType.EDGE_MOBILE, label: t('Edge Mobile')},
  {value: BrowserType.OPERA_MOBILE, label: t('Opera Mobile')},
];

export default function BrowserTypeSelector() {
  const location = useLocation();

  const value = decodeScalar(location.query[SpanIndexedField.BROWSER_NAME]) ?? '';

  return (
    <CompactSelect
      triggerProps={{prefix: t('Browser Type')}}
      value={value}
      options={browserOptions ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SpanIndexedField.BROWSER_NAME]: newValue.value,
          },
        });
      }}
    />
  );
}
