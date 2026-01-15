import type { TickStyle } from "sentry/components/checkInTimeline/types";
import { SchedulePreviewStatus } from "sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets";
import { t } from "sentry/locale";
import { SchedulePreview } from "../common/schedulePreview";
import { CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE, CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD, CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT, DEFAULT_CRONTAB, useCronDetectorFormField, CRON_DEFAULT_RECOVERY_THRESHOLD, CRON_DEFAULT_TIMEZONE } from "./fields";
import { ScheduleType } from "sentry/views/insights/crons/types";
import { useDebouncedValue } from "sentry/utils/useDebouncedValue";

const tickStyle: TickStyle<SchedulePreviewStatus> = theme => ({
  [SchedulePreviewStatus.ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [SchedulePreviewStatus.OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
    hatchTick: theme.colors.green200,
  },
});

const statusToText: Record<SchedulePreviewStatus, string> = {
  [SchedulePreviewStatus.OK]: t('Okay'),
  [SchedulePreviewStatus.ERROR]: t('Failed'),
  [SchedulePreviewStatus.SUB_FAILURE_ERROR]: t('Failed (Sub-Threshold)'),
  [SchedulePreviewStatus.SUB_RECOVERY_OK]: t('Okay (Sub-Threshold)'),
};

export const statusPrecedent: SchedulePreviewStatus[] = [
  SchedulePreviewStatus.SUB_FAILURE_ERROR,
  SchedulePreviewStatus.SUB_RECOVERY_OK,
  SchedulePreviewStatus.ERROR,
  SchedulePreviewStatus.OK,
];

const DEBOUNCE_DELAY = 200;

export function PreviewSection() {
  const scheduleType = useCronDetectorFormField('scheduleType') ?? ScheduleType.CRONTAB;
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab') ?? DEFAULT_CRONTAB;
  const scheduleIntervalValue = useCronDetectorFormField('scheduleIntervalValue') ?? CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE;
  const scheduleIntervalUnit = useCronDetectorFormField('scheduleIntervalUnit') ?? CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT;
  const timezone = useCronDetectorFormField('timezone') ?? CRON_DEFAULT_TIMEZONE;
  const failureIssueThreshold = useCronDetectorFormField('failureIssueThreshold') ?? CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD;
  const recoveryThreshold = useCronDetectorFormField('recoveryThreshold') ?? CRON_DEFAULT_RECOVERY_THRESHOLD;

  // Debouncing typed fields
  const debouncedScheduleCrontab = useDebouncedValue(scheduleCrontab, DEBOUNCE_DELAY);
  const debouncedFailureIssueThreshold = useDebouncedValue(failureIssueThreshold, DEBOUNCE_DELAY);
  const debouncedRecoveryThreshold = useDebouncedValue(recoveryThreshold, DEBOUNCE_DELAY);

  return  (
    <SchedulePreview
      sticky
      tickStyle={tickStyle}
      statusToText={statusToText}
      statusPrecedent={statusPrecedent}
      scheduleType={scheduleType as ScheduleType}
      scheduleCrontab={debouncedScheduleCrontab}
      scheduleIntervalValue={scheduleIntervalValue}
      scheduleIntervalUnit={scheduleIntervalUnit}
      timezone={timezone}
      failureIssueThreshold={debouncedFailureIssueThreshold}
      recoveryThreshold={debouncedRecoveryThreshold}
    />
  );
}
