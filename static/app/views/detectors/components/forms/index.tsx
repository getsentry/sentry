import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {CronDetectorForm} from 'sentry/views/detectors/components/forms/cron';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric/metric';
import {UptimeDetectorForm} from 'sentry/views/detectors/components/forms/uptime';

type DetectorFormProps = {
  detectorType: DetectorType;
};

export function DetectorForm({detectorType}: DetectorFormProps) {
  switch (detectorType) {
    case 'metric_issue':
      return <MetricDetectorForm />;
    case 'uptime_subscription':
      return <CronDetectorForm />;
    case 'uptime_domain_failure':
      return <UptimeDetectorForm />;
    case 'error':
      // TODO: Redirect to another page or display an error message?
      // Error detectors cannot be edited.
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}
