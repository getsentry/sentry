import type {CheckInBucket} from 'sentry/components/checkInTimeline/types';

import type {CheckInStatus, MonitorBucket} from '../types';

export function selectCheckInData(
  stats: MonitorBucket[],
  env: string
): Array<CheckInBucket<CheckInStatus>> {
  return stats.map(([ts, envs]) => [
    ts,
    envs[env] ?? {in_progress: 0, ok: 0, error: 0, missed: 0, timeout: 0, unknown: 0},
  ]);
}
