import type {MonitorBucketEnvMapping, StatsBucket} from '../types';

import {CHECKIN_STATUS_PRECEDENT} from './constants';

export function getAggregateStatus(envData: MonitorBucketEnvMapping) {
  return Object.values(envData).reduce((currentStatus, value) => {
    for (const [index, status] of CHECKIN_STATUS_PRECEDENT.entries()) {
      if (value[status] > 0 && index > CHECKIN_STATUS_PRECEDENT.indexOf(currentStatus)) {
        currentStatus = status;
      }
    }
    return currentStatus;
  }, CHECKIN_STATUS_PRECEDENT[0]);
}

export function getAggregateStatusFromStatsBucket(stats: StatsBucket) {
  return (
    [...CHECKIN_STATUS_PRECEDENT].reverse().find(status => stats[status] > 0) ||
    CHECKIN_STATUS_PRECEDENT[0]
  );
}
