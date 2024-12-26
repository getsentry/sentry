import type {MonitorBucketEnvMapping, StatsBucket} from '../types';

import {CHECKIN_STATUS_PRECEDENT} from './constants';

/**
 * Given two env mappings e.g. {prod: {ok: 1, missed: 0, etc..}}
 * combines job status counts
 */
export function mergeEnvMappings(
  envMappingA: MonitorBucketEnvMapping,
  envMappingB: MonitorBucketEnvMapping
): MonitorBucketEnvMapping {
  const combinedEnvs = new Set([
    ...Object.keys(envMappingA),
    ...Object.keys(envMappingB),
  ]);
  return [...combinedEnvs].reduce<MonitorBucketEnvMapping>((mergedEnvs, env) => {
    const mergedStatusCounts: Partial<StatsBucket> = {};
    for (const status of CHECKIN_STATUS_PRECEDENT) {
      mergedStatusCounts[status] =
        (envMappingA[env]?.[status] ?? 0) + (envMappingB[env]?.[status] ?? 0);
    }
    mergedEnvs[env] = mergedStatusCounts as StatsBucket;
    return mergedEnvs;
  }, {});
}

/**
 * Combines job status counts
 */
export function mergeStats(statsA: StatsBucket, statsB: StatsBucket): StatsBucket {
  const combinedStats = {} as StatsBucket;
  for (const status of CHECKIN_STATUS_PRECEDENT) {
    combinedStats[status] = (statsA[status] ?? 0) + (statsB[status] ?? 0);
  }
  return combinedStats;
}
