import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {SchedulePreview} from 'sentry/views/detectors/components/forms/common/schedulePreview';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import type {Schedule} from 'sentry/views/detectors/hooks/useMonitorsScheduleSamples';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import {useUptimeDetectorFormField} from './fields';

const statusToText: Record<SchedulePreviewStatus, string> = {
  [SchedulePreviewStatus.OK]: t('Uptime'),
  [SchedulePreviewStatus.ERROR]: t('Downtime'),
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: t('Failure (Sub-Threshold)'),
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: t('Uptime (Sub-Threshold)'),
};

const DEBOUNCE_DELAY = 300;

export function PreviewSection() {
  const downtimeThreshold = useUptimeDetectorFormField('downtimeThreshold');
  const recoveryThreshold = useUptimeDetectorFormField('recoveryThreshold');

  // Debouncing typed fields
  const debouncedDowntimeThreshold = useDebouncedValue(downtimeThreshold, DEBOUNCE_DELAY);
  const debouncedRecoveryThreshold = useDebouncedValue(recoveryThreshold, DEBOUNCE_DELAY);

  const intervalSeconds = useUptimeDetectorFormField('intervalSeconds');
  const intervalMinutes = intervalSeconds / 60;

  const schedule: Schedule = {
    type: ScheduleType.INTERVAL,
    value: intervalMinutes,
    unit: 'minute',
  };

  return (
    <SchedulePreview
      statusToText={statusToText}
      schedule={schedule}
      timezone="UTC"
      failureIssueThreshold={debouncedDowntimeThreshold}
      recoveryThreshold={debouncedRecoveryThreshold}
    />
  );
}
