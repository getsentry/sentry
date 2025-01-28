import type {ReactNode} from 'react';

import Feature from 'sentry/components/acl/feature';
import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  AutoSampleState,
  MEPState,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

interface MetricsEventsOption {
  label: string;
  prefix: ReactNode;
  value: MEPState;
}

const autoTextMap: Record<AutoSampleState, string> = {
  [AutoSampleState.UNSET]: t('Auto'),
  [AutoSampleState.METRICS]: t('Auto (metrics)'),
  [AutoSampleState.TRANSACTIONS]: t('Auto (transactions)'),
};

function getOptions(mepContext: MetricsEnhancedSettingContext): MetricsEventsOption[] {
  const autoText = autoTextMap[mepContext.autoSampleState];

  const prefix = <span>{t('Dataset')}</span>;

  return [
    {
      value: MEPState.AUTO,
      prefix,
      label: autoText,
    },
    {
      value: MEPState.METRICS_ONLY,
      prefix,
      label: t('Processed'),
    },
    {
      value: MEPState.TRANSACTIONS_ONLY,
      prefix,
      label: t('Indexed'),
    },
  ];
}

export function MetricsEventsDropdown() {
  return (
    <Feature features="performance-use-metrics">
      <InnerDropdown />
    </Feature>
  );
}

function InnerDropdown() {
  const mepSetting = useMEPSettingContext();

  const options = getOptions(mepSetting);

  const currentOption =
    options.find(({value}) => value === mepSetting.metricSettingState) || options[0]!;

  return (
    <CompactSelect
      triggerProps={{prefix: currentOption.prefix}}
      value={currentOption.value}
      options={options}
      onChange={opt => mepSetting.setMetricSettingState(opt.value)}
    />
  );
}
