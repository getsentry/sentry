import {t} from 'sentry/locale';
import {SchedulePreview} from 'sentry/views/detectors/components/forms/common/schedulePreview';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import {useUptimeDetectorFormField} from './fields';

const statusToText: Record<SchedulePreviewStatus, string> = {
  [SchedulePreviewStatus.OK]: t('Uptime'),
  [SchedulePreviewStatus.ERROR]: t('Downtime'),
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: t('Failure (Sub-Threshold)'),
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: t('Uptime (Sub-Threshold)'),
};

export function PreviewSection() {
  const downtimeThreshold = useUptimeDetectorFormField('downtimeThreshold');
  const recoveryThreshold = useUptimeDetectorFormField('recoveryThreshold');

  const intervalSeconds = useUptimeDetectorFormField('intervalSeconds');
  const intervalMinutes = Math.floor(intervalSeconds / 60);

  return (
    <SchedulePreview
      statusToText={statusToText}
      scheduleType={ScheduleType.INTERVAL}
      scheduleCrontab=""
      scheduleIntervalValue={intervalMinutes}
      scheduleIntervalUnit="minute"
      timezone="UTC"
      failureIssueThreshold={downtimeThreshold}
      recoveryThreshold={recoveryThreshold}
    />
  );
}
