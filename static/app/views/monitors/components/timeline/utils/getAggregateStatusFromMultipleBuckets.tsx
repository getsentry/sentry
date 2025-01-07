import type {MonitorBucketEnvMapping, StatsBucket} from '../types';

import {CHECKIN_STATUS_PRECEDENT} from './constants';
import {
  getAggregateStatus,
  getAggregateStatusFromStatsBucket,
} from './getAggregateStatus';

/**
 * Given multiple env buckets [{prod: {ok: 1, ...}, {prod: {ok: 0, ...}}]
 * returns the aggregate status across all buckets
 */
export function getAggregateStatusFromMultipleBuckets(
  envDataArr: MonitorBucketEnvMapping[]
) {
  return envDataArr
    .map(getAggregateStatus)
    .reduce(
      (aggregateStatus, currentStatus) =>
        CHECKIN_STATUS_PRECEDENT.indexOf(currentStatus!) >
        CHECKIN_STATUS_PRECEDENT.indexOf(aggregateStatus!)
          ? currentStatus
          : aggregateStatus,
      CHECKIN_STATUS_PRECEDENT[0]
    );
}

/**
 * Given multiple stats buckets [{..., error: 1, unknown: 0}, {..., error: 0, unknown: 4}]
 * returns the aggregate status across all buckets (unknown)
 */
export function getAggregateStatusFromMultipleStatsBuckets(statsArr: StatsBucket[]) {
  return statsArr
    .map(getAggregateStatusFromStatsBucket)
    .reduce(
      (aggregateStatus, currentStatus) =>
        CHECKIN_STATUS_PRECEDENT.indexOf(currentStatus!) >
        CHECKIN_STATUS_PRECEDENT.indexOf(aggregateStatus!)
          ? currentStatus
          : aggregateStatus,
      CHECKIN_STATUS_PRECEDENT[0]
    );
}
