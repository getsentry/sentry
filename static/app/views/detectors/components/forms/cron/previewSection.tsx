import type { TickStyle } from "sentry/components/checkInTimeline/types";
import { SchedulePreviewStatus } from "sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets";
import { t } from "sentry/locale";
import { SchedulePreview } from "../common/schedulePreview";
import { useCronDetectorFormField } from "./fields";
import type { ScheduleType } from "sentry/views/insights/crons/types";

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

export function PreviewSection() {
  const scheduleType = useCronDetectorFormField('scheduleType');
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab');
  const scheduleIntervalValue = useCronDetectorFormField('scheduleIntervalValue');
  const scheduleIntervalUnit = useCronDetectorFormField('scheduleIntervalUnit');
  const timezone = useCronDetectorFormField('timezone');
  const failureIssueThreshold = useCronDetectorFormField('failureIssueThreshold');
  const recoveryThreshold = useCronDetectorFormField('recoveryThreshold');

  return  (
    <SchedulePreview
      sticky
      tickStyle={tickStyle}
      statusToText={statusToText}
      statusPrecedent={statusPrecedent}
      scheduleType={scheduleType as ScheduleType}
      scheduleCrontab={scheduleCrontab}
      scheduleIntervalValue={scheduleIntervalValue}
      scheduleIntervalUnit={scheduleIntervalUnit}
      timezone={timezone}
      failureIssueThreshold={failureIssueThreshold}
      recoveryThreshold={recoveryThreshold}
    />
  );
}
