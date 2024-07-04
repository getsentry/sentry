import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import ContextIcon from 'sentry/components/events/contexts/contextIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

const LabelContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

function optionToLabel(iconName: string, labelValue: string): React.ReactNode {
  return (
    <LabelContainer>
      <ContextIcon name={iconName} size="md" />
      <div>{labelValue}</div>
    </LabelContainer>
  );
}

const browserOptions = [
  {value: '', label: t('All')},
  {value: BrowserType.CHROME, label: optionToLabel('chrome', 'Chrome')},
  {value: BrowserType.SAFARI, label: optionToLabel('safari', 'Safari')},
  {value: BrowserType.FIREFOX, label: optionToLabel('firefox', 'Firefox')},
  {value: BrowserType.OPERA, label: optionToLabel('opera', 'Opera')},
  {value: BrowserType.EDGE, label: optionToLabel('edge', 'Edge')},

  {value: BrowserType.CHROME_MOBILE, label: optionToLabel('chrome', 'Chrome Mobile')},
  {value: BrowserType.SAFARI_MOBILE, label: optionToLabel('safari', 'Safari Mobile')},
  {value: BrowserType.FIREFOX_MOBILE, label: optionToLabel('firefox', 'Firefox Mobile')},
  {value: BrowserType.OPERA_MOBILE, label: optionToLabel('opera', 'Opera Mobile')},
  {value: BrowserType.EDGE_MOBILE, label: optionToLabel('edge', 'Edge Mobile')},
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
