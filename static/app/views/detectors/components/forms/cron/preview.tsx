import {MockTimelineVisualization} from 'sentry/views/insights/crons/components/mockTimelineVisualization';

import {useCronDetectorFormField} from './fields';

function PreviewSchedule() {
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab');
  const scheduleIntervalValue = useCronDetectorFormField('scheduleIntervalValue');
  const scheduleType = useCronDetectorFormField('scheduleType');
  const failureTolerance = useCronDetectorFormField('failureIssueThreshold');
  const recoveryThreshold = useCronDetectorFormField('recoveryThreshold');
  const scheduleIntervalUnit = useCronDetectorFormField('scheduleIntervalUnit');
  const timezone = useCronDetectorFormField('timezone');

  const schedule = {
    scheduleType,
    cronSchedule: scheduleCrontab,
    intervalFrequency: scheduleIntervalValue,
    intervalUnit: scheduleIntervalUnit,
    timezone: typeof timezone === 'string' ? timezone : undefined,
  };

  return (
    <MockTimelineVisualization
      schedule={schedule}
      failureTolerance={failureTolerance}
      recoveryThreshold={recoveryThreshold}
    />
  );
}

export default PreviewSchedule;
