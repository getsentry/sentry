import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {SchedulePreview} from 'sentry/views/detectors/components/forms/common/schedulePreview';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import type {MonitorIntervalUnit} from 'sentry/views/insights/crons/types';
import {ScheduleType} from 'sentry/views/insights/crons/types';

const statusToText: Record<SchedulePreviewStatus, string> = {
  [SchedulePreviewStatus.OK]: t('Okay'),
  [SchedulePreviewStatus.ERROR]: t('Failed'),
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: t('Failed (Sub-Threshold)'),
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: t('Okay (Sub-Threshold)'),
};

const DEBOUNCE_DELAY = 300;

interface PreviewSectionProps {
  failureIssueThreshold: number;
  recoveryThreshold: number;
  scheduleCrontab: string;
  scheduleIntervalUnit: MonitorIntervalUnit;
  scheduleIntervalValue: number;
  scheduleType: ScheduleType;
  timezone: string;
}

export function PreviewSection({
  scheduleType,
  scheduleCrontab,
  scheduleIntervalValue,
  scheduleIntervalUnit,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
}: PreviewSectionProps) {
  const debouncedScheduleCrontab = useDebouncedValue(scheduleCrontab, DEBOUNCE_DELAY);
  const debouncedFailureIssueThreshold = useDebouncedValue(
    failureIssueThreshold,
    DEBOUNCE_DELAY
  );
  const debouncedRecoveryThreshold = useDebouncedValue(recoveryThreshold, DEBOUNCE_DELAY);

  const schedule =
    scheduleType === ScheduleType.CRONTAB
      ? {
          type: ScheduleType.CRONTAB as const,
          value: debouncedScheduleCrontab,
        }
      : {
          type: ScheduleType.INTERVAL as const,
          value: scheduleIntervalValue,
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
