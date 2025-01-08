import type {StatsBucket} from '../types';

import {getAggregateStatus} from './getAggregateStatus';

/**
 * Given multiple stats buckets [{..., error: 1, unknown: 0}, {..., error: 0, unknown: 4}]
 * returns the aggregate status across all buckets (unknown)
 */
export function getAggregateStatusFromMultipleBuckets<Status extends string>(
  statusPrecedent: Status[],
  statsArr: StatsBucket<Status>[]
) {
  return statsArr
    .map(stats => getAggregateStatus(statusPrecedent, stats))
    .reduce(
      (aggregateStatus, currentStatus) =>
        statusPrecedent.indexOf(currentStatus!) >
        statusPrecedent.indexOf(aggregateStatus!)
          ? currentStatus
          : aggregateStatus,
      statusPrecedent[0]
    );
}
