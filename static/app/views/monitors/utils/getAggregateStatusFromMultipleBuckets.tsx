import {MonitorBucketEnvMapping} from 'sentry/views/monitors/components/overviewTimeline/types';

import {CHECKIN_STATUS_PRECEDENT} from './constants';
import {getAggregateStatus} from './getAggregateStatus';

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
        CHECKIN_STATUS_PRECEDENT.indexOf(currentStatus) >
        CHECKIN_STATUS_PRECEDENT.indexOf(aggregateStatus)
          ? currentStatus
          : aggregateStatus,
      CHECKIN_STATUS_PRECEDENT[0]
    );
}
