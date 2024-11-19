import {CheckInStatus} from 'sentry/views/monitors/types';

import type {StatsBucket} from '../types';

// Orders the status in terms of ascending precedence for showing to the user
export const CHECKIN_STATUS_PRECEDENT = [
  CheckInStatus.IN_PROGRESS,
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
  CheckInStatus.UNKNOWN,
] satisfies Array<keyof StatsBucket>;
