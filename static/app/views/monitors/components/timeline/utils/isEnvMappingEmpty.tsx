import type {MonitorBucketEnvMapping, StatsBucket} from '../types';

/**
 * Determines if an environment mapping includes any job run data
 */
export function isEnvMappingEmpty(envMapping: MonitorBucketEnvMapping) {
  return Object.keys(envMapping).length === 0;
}

export function isStatsBucketEmpty(stats: StatsBucket): boolean {
  return Object.values(stats).every(value => value === 0);
}
