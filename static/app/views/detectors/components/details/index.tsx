import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {FallbackDetectorDetails} from 'sentry/views/detectors/components/details/fallback';
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
    case 'uptime_subscription':
    case 'error':
      return <FallbackDetectorDetails detector={detector} project={project} />;
    default:
      unreachable(detectorType);
      return <FallbackDetectorDetails detector={detector} project={project} />;
  }
}
