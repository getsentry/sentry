import sortBy from 'lodash/sortBy';
import moment from 'moment-timezone';

import {
  MonitorStatus,
  type Monitor,
  type MonitorEnvironment,
} from 'sentry/views/insights/crons/types';

const MONITOR_STATUS_PRECEDENT = [
  MonitorStatus.ERROR,
  MonitorStatus.OK,
  MonitorStatus.ACTIVE,
  MonitorStatus.DISABLED,
];

/**
 * Get the aggregate MonitorStatus of a set of monitor environments.
 */
export function getAggregateEnvStatus(environments: MonitorEnvironment[]): MonitorStatus {
  const status = MONITOR_STATUS_PRECEDENT.find(s =>
    environments.some(env => env.status === s)
  );

  return status ?? MonitorStatus.ACTIVE;
}

/**
 * Priority order for selecting which environment to display/use.
 * Prefers healthy environments over failing ones.
 */
const MONITOR_ENVIRONMENT_SORT_ORDER = [
  MonitorStatus.OK,
  MonitorStatus.ERROR,
  MonitorStatus.DISABLED,
  MonitorStatus.ACTIVE,
];

/**
 * Gets the environment with the earliest upcoming check-in, prioritized by status.
 *
 * Priority order:
 * 1. OK status - prefer actively healthy environments
 * 2. ERROR status - fall back to failing environments
 * 3. DISABLED status - disabled environments
 * 4. ACTIVE status - least priority (no check-ins yet)
 *
 * Note: ACTIVE status means no check-ins yet, so it won't have nextCheckIn/lastCheckIn.
 *
 * Within each status group, selects the environment with the earliest nextCheckIn.
 * This is useful for both display and for determining when to refetch data.
 */
export function getNextCheckInEnv(environments: MonitorEnvironment[]) {
  return sortBy(
    environments,
    e => MONITOR_ENVIRONMENT_SORT_ORDER.indexOf(e.status),
    e => e.nextCheckIn
  )[0];
}

/**
 * Interval for polling the monitor when we're waiting for the very first
 * check-in.
 */
const WAITING_FIRST_CHECK_IN_INTERVAL_MS = 5_000;

/**
 * Calculates the refetch interval for a monitor based on when the next
 * check-in is expected.
 *
 * Uses exponential backoff when check-in is late:
 * - 0-1 minute late: 5 seconds
 * - 1-5 minutes late: 30 seconds
 * - 5-15 minutes late: 2 minutes
 * - 15+ minutes late: 5 minutes
 * - Cap at 10 minutes
 *
 * Returns:
 * - WAITING_FIRST_CHECK_IN_INTERVAL_MS if no check-in has been received yet
 * - Time until next check-in if it's in the future
 * - Backoff interval based on how late the check-in is
 */
export function getMonitorRefetchInterval(monitor: Monitor, now: Date) {
  const nowMoment = moment(now);
  const env = getNextCheckInEnv(monitor.environments);
  const nextCheckIn = env?.nextCheckIn ?? null;

  if (!nextCheckIn) {
    return WAITING_FIRST_CHECK_IN_INTERVAL_MS;
  }

  const nextCheckInMoment = moment(nextCheckIn);

  // Interval is the time until we expect the next check-in
  if (nextCheckInMoment.isAfter(nowMoment)) {
    return nextCheckInMoment.diff(nowMoment, 'milliseconds');
  }

  // Check-in is late - use exponential backoff
  const minutesLate = nowMoment.diff(nextCheckInMoment, 'minutes');

  if (minutesLate < 1) {
    return 5_000;
  }
  if (minutesLate < 5) {
    return 30_000;
  }
  if (minutesLate < 15) {
    return 2 * 60_000;
  }
  if (minutesLate < 30) {
    return 5 * 60_000;
  }

  // If the check-in is very late just poll once every 10 minutes
  return 10 * 60_000;
}
