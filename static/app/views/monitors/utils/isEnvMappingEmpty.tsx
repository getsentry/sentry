import {MonitorBucketEnvMapping} from 'sentry/views/monitors/components/overviewTimeline/types';

/**
 * Determines if an environment mapping includes any job run data
 */
export function isEnvMappingEmpty(envMapping: MonitorBucketEnvMapping) {
  return Object.keys(envMapping).length === 0;
}
