import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {useMetricsIntervalParam} from 'sentry/views/metrics/utils/useMetricsIntervalParam';

export function IntervalSelect() {
  const {interval, setInterval, currentIntervalOptions} = useMetricsIntervalParam();

  return (
    <CompactSelect
      value={interval}
      onChange={({value}) => setInterval(value)}
      triggerProps={{
        prefix: t('Interval'),
      }}
      options={currentIntervalOptions}
    />
  );
}
