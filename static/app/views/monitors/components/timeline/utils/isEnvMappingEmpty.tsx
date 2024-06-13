import type {MonitorBucketEnvMapping} from '../types';

/**
 * Determines if an environment mapping includes any job run data
 */
export function isEnvMappingEmpty(envMapping: MonitorBucketEnvMapping) {
  return Object.keys(envMapping).length === 0;
}
