import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import ContextIcon from 'sentry/components/events/contexts/contextIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
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
  {
    value: BrowserType.CHROME,
    label: optionToLabel('chrome', 'Chrome'),
    textValue: 'Chrome',
  },
  {
    value: BrowserType.SAFARI,
    label: optionToLabel('safari', 'Safari'),
    textValue: 'Safari',
  },
  {
    value: BrowserType.FIREFOX,
    label: optionToLabel('firefox', 'Firefox'),
    textValue: 'Firefox',
  },
  {value: BrowserType.OPERA, label: optionToLabel('opera', 'Opera'), textValue: 'Opera'},
  {value: BrowserType.EDGE, label: optionToLabel('edge', 'Edge'), textValue: 'Edge'},
  {
    value: BrowserType.CHROME_MOBILE,
    label: optionToLabel('chrome', 'Chrome Mobile'),
    textValue: 'Chrome Mobile',
  },
  {
    value: BrowserType.SAFARI_MOBILE,
    label: optionToLabel('safari', 'Safari Mobile'),
    textValue: 'Safari Mobile',
  },
  {
    value: BrowserType.FIREFOX_MOBILE,
    label: optionToLabel('firefox', 'Firefox Mobile'),
    textValue: 'Firefox Mobile',
  },
  {
    value: BrowserType.OPERA_MOBILE,
    label: optionToLabel('opera', 'Opera Mobile'),
    textValue: 'Opera Mobile',
  },
  {
    value: BrowserType.EDGE_MOBILE,
    label: optionToLabel('edge', 'Edge Mobile'),
    textValue: 'Edge Mobile',
  },
];

export default function BrowserTypeSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const value = decodeList(location.query[SpanIndexedField.BROWSER_NAME]);

  return (
    <CompactSelect
      triggerProps={{prefix: t('Browser Type')}}
      multiple
      clearable
      value={value}
      triggerLabel={value.length === 0 ? 'All' : undefined}
      menuTitle={'Filter Browsers'}
      options={browserOptions ?? []}
      onChange={(selectedOptions: SelectOption<string>[]) => {
        trackAnalytics('insight.vital.select_browser_value', {
          organization,
          browsers: selectedOptions.map(v => v.value),
        });

        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanIndexedField.BROWSER_NAME]: selectedOptions.map(option => option.value),
          },
        });
      }}
    />
  );
}
