import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';

export function getDetectorEnvironment(detector: Detector): string | null {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return (
        detector.dataSources?.find(ds => ds.type === 'snuba_query_subscription')?.queryObj
          ?.snubaQuery.environment ?? null
      );
    case 'uptime_domain_failure':
      return detector.config.environment ?? null;
    case 'uptime_subscription':
      return detector.config.environment ?? null;
    case 'error':
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}
