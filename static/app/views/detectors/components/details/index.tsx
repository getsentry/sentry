import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {ErrorDetectorDetails} from 'sentry/views/detectors/components/details/error';
import {FallbackDetectorDetails} from 'sentry/views/detectors/components/details/fallback';
import {MetricDetectorDetails} from 'sentry/views/detectors/components/details/metric';
import {UptimeDetectorDetails} from 'sentry/views/detectors/components/details/uptime';

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
      return <UptimeDetectorDetails detector={detector} project={project} />;
    case 'error':
      return <ErrorDetectorDetails detector={detector} project={project} />;
    case 'uptime_subscription':
      return <FallbackDetectorDetails detector={detector} project={project} />;
    default:
      unreachable(detectorType);
      return <FallbackDetectorDetails detector={detector} project={project} />;
  }
}
