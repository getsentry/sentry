import Feature from 'sentry/components/acl/feature';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {t} from 'sentry/locale';
import {
  AutoSampleState,
  MEPState,
  MetricsEnhancedSettingContext,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

interface MetricsEventsOption {
  label: string;
  prefix: string;
  value: MEPState;
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
      value: MEPState.auto,
      prefix,
      label: autoText,
    },
    {
      value: MEPState.metricsOnly,
      prefix,
      label: t('Ingested only'),
    },
    {
      value: MEPState.transactionsOnly,
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
    options.find(({value}) => value === mepSetting.metricSettingState) || options[0];

  return (
    <CompactSelect
      triggerProps={{prefix: currentOption.prefix}}
      value={currentOption.value}
      options={options}
      onChange={opt => mepSetting.setMetricSettingState(opt.value)}
    />
  );
}
