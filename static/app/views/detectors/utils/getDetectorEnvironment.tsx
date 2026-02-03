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
    case 'monitor_check_in_failure':
      // Crons can have multiple environments
      return null;
    case 'error':
    case 'issue_stream':
      return null;
    default:
      unreachable(detectorType);
      return null;
  }
}
