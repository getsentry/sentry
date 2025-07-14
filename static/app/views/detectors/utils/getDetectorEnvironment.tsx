import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';

const ALL_ENVIRONMENTS = t('All environments');

export function getDetectorEnvironment(detector: Detector) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return (
        detector.dataSources?.find(ds => ds.type === 'snuba_query_subscription')?.queryObj
          ?.snubaQuery.environment ?? ALL_ENVIRONMENTS
      );
    case 'uptime_domain_failure':
      return detector.config.environment ?? ALL_ENVIRONMENTS;
    case 'uptime_subscription':
      // TODO: Implement this when we know the shape of object
      return ALL_ENVIRONMENTS;
    case 'error':
      return ALL_ENVIRONMENTS;
    default:
      unreachable(detectorType);
      return ALL_ENVIRONMENTS;
  }
}
