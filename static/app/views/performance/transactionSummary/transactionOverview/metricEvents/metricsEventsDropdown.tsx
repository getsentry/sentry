import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import {
  AutoSampleState,
  MEPState,
  MetricsEnhancedSettingContext,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

interface MetricsEventsOption {
  field: MEPState;
  label: string;
  prefix: string;
}

const autoTextMap: Record<AutoSampleState, string> = {
  [AutoSampleState.unset]: t('Auto'),
  [AutoSampleState.metrics]: t('Auto (ingested)'),
  [AutoSampleState.transactions]: t('Auto (stored)'),
};

function getOptions(mepContext: MetricsEnhancedSettingContext): MetricsEventsOption[] {
  const autoText = autoTextMap[mepContext.autoSampleState];
  const prefix = t('Sample');

  return [
    {
      field: MEPState.auto,
      prefix,
      label: autoText,
    },
    {
      field: MEPState.metricsOnly,
      prefix,
      label: t('Ingested only'),
    },
    {
      field: MEPState.transactionsOnly,
      prefix,
      label: t('Stored only'),
    },
  ];
}

export function MetricsEventsDropdown() {
  return (
    <Feature features={['performance-use-metrics']}>
      <InnerDropdown />
    </Feature>
  );
}

function InnerDropdown() {
  const mepSetting = useMEPSettingContext();

  const options = getOptions(mepSetting);

  const currentOption =
    options.find(({field}) => field === mepSetting.metricSettingState) || options[0];

  return (
    <DropdownContainer>
      <DropdownControl
        buttonProps={{prefix: currentOption.prefix}}
        label={currentOption.label}
      >
        {options.map(option => (
          <DropdownItem
            key={option.field}
            eventKey={option.field}
            isActive={option.field === currentOption.field}
            onSelect={key => mepSetting.setMetricSettingState(key)}
          >
            {option.label}
          </DropdownItem>
        ))}
      </DropdownControl>
    </DropdownContainer>
  );
}

const DropdownContainer = styled('div')``;
