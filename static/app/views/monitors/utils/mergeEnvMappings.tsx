import {MonitorBucketEnvMapping} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CHECKIN_STATUS_PRECEDENT} from 'sentry/views/monitors/utils/constants';

/**
 * Given two env mappings e.g. {prod: {ok: 1, missed: 0, etc..}}
 * combines job status counts
 */
export function mergeEnvMappings(
  envMappingA: MonitorBucketEnvMapping,
  envMappingB: MonitorBucketEnvMapping
) {
  const combinedEnvs = new Set([
    ...Object.keys(envMappingA),
    ...Object.keys(envMappingB),
  ]);
  return [...combinedEnvs].reduce((mergedEnvs, env) => {
    const mergedStatusCounts = {};
    for (const status of CHECKIN_STATUS_PRECEDENT) {
      mergedStatusCounts[status] =
        (envMappingA[env]?.[status] ?? 0) + (envMappingB[env]?.[status] ?? 0);
    }
    mergedEnvs[env] = mergedStatusCounts;
    return mergedEnvs;
  }, {});
}
