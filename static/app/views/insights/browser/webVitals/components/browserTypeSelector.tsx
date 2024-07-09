import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import ContextIcon from 'sentry/components/events/contexts/contextIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import decodeBrowserType, {
  BrowserType,
} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SpanIndexedField} from 'sentry/views/insights/types';

const LabelContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  width: max-content;
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
  const organization = useOrganization();
  const location = useLocation();

  const value = decodeBrowserType(location.query[SpanIndexedField.BROWSER_NAME]);

  return (
    <CompactSelect
      triggerProps={{prefix: t('Browser Type')}}
      value={value}
      options={browserOptions ?? []}
      onChange={newValue => {
        trackAnalytics('insight.vital.select_browser_value', {
          organization,
          browser: newValue.value,
        });
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
