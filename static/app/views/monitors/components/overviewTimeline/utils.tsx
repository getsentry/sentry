import moment from 'moment';

import {CheckInStatus} from 'sentry/views/monitors/types';

import {MonitorBucketEnvMapping, TimeWindow, TimeWindowData} from './types';

// Stores options and data which correspond to each selectable time window
export const timeWindowData: TimeWindowData = {
  '1h': {elapsedMinutes: 60, timeMarkerInterval: 10, dateTimeProps: {timeOnly: true}},
  '24h': {
    elapsedMinutes: 60 * 24,
    timeMarkerInterval: 60 * 4,
    dateTimeProps: {timeOnly: true},
  },
  '7d': {elapsedMinutes: 60 * 24 * 7, timeMarkerInterval: 60 * 24, dateTimeProps: {}},
  '30d': {
    elapsedMinutes: 60 * 24 * 30,
    timeMarkerInterval: 60 * 24 * 5,
    dateTimeProps: {dateOnly: true},
  },
};

export function getStartFromTimeWindow(end: Date, timeWindow: TimeWindow): Date {
  const {elapsedMinutes} = timeWindowData[timeWindow];
  const start = moment(end).subtract(elapsedMinutes, 'minute');

  return start.toDate();
}

/**
 * Given two env mappings e.g. {prod: {ok: 1, missed: 0, etc..}}
 * combines job status counts
 * @param envMappingA
 * @param envMappingB
 * @returns The merged environment mapping
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
    for (const status of Object.values(CheckInStatus)) {
      mergedStatusCounts[status] =
        (envMappingA[env]?.[status] ?? 0) + (envMappingB[env]?.[status] ?? 0);
    }
    mergedEnvs[env] = mergedStatusCounts;
    return mergedEnvs;
  }, {});
}

/**
 * Determines if an environment mapping includes any job run data
 * @param envMapping
 * @returns Whether the environment mapping includes job runs
 */
export function isEnvMappingEmpty(envMapping: MonitorBucketEnvMapping) {
  return Object.keys(envMapping).length === 0;
}
