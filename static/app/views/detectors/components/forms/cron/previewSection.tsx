import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {SchedulePreview} from 'sentry/views/detectors/components/forms/common/schedulePreview';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import type {Schedule} from 'sentry/views/detectors/hooks/useMonitorsScheduleSamples';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import {useCronDetectorFormField} from './fields';

const statusToText: Record<SchedulePreviewStatus, string> = {
  [SchedulePreviewStatus.OK]: t('Okay'),
  [SchedulePreviewStatus.ERROR]: t('Failed'),
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: t('Failed (Sub-Threshold)'),
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: t('Okay (Sub-Threshold)'),
};

const DEBOUNCE_DELAY = 300;

export function PreviewSection() {
  const scheduleType = useCronDetectorFormField('scheduleType');
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab');
  const scheduleIntervalValue = useCronDetectorFormField('scheduleIntervalValue');
  const scheduleIntervalUnit = useCronDetectorFormField('scheduleIntervalUnit');
  const timezone = useCronDetectorFormField('timezone');
  const failureIssueThreshold = useCronDetectorFormField('failureIssueThreshold');
  const recoveryThreshold = useCronDetectorFormField('recoveryThreshold');

  // Debouncing typed fields
  const debouncedScheduleCrontab = useDebouncedValue(scheduleCrontab, DEBOUNCE_DELAY);
  const debouncedFailureIssueThreshold = useDebouncedValue(
    failureIssueThreshold,
    DEBOUNCE_DELAY
  );
  const debouncedRecoveryThreshold = useDebouncedValue(recoveryThreshold, DEBOUNCE_DELAY);

  const schedule: Schedule = {
    type: scheduleType,
    value:
      scheduleType === ScheduleType.CRONTAB
        ? debouncedScheduleCrontab
        : scheduleIntervalValue,
    unit: scheduleIntervalUnit,
  };

  return (
    <SchedulePreview
      statusToText={statusToText}
      schedule={schedule}
      timezone={timezone}
      failureIssueThreshold={debouncedFailureIssueThreshold}
      recoveryThreshold={debouncedRecoveryThreshold}
    />
  );
}
