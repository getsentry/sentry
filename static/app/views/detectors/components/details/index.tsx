import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {MetricDetectorDetails} from 'sentry/views/detectors/components/details/metric';

type DetectorDetailsContentProps = {
  detector: Detector;
  project: Project;
};

export function DetectorDetailsContent({detector, project}: DetectorDetailsContentProps) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return <MetricDetectorDetails detector={detector} project={project} />;
    case 'uptime_domain_failure':
      return null;
    case 'uptime_subscription':
      return null;
    case 'error':
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}
