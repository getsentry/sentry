import {MonitorBucketEnvMapping} from 'sentry/views/monitors/components/overviewTimeline/types';

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
