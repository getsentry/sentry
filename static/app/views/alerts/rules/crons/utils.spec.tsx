import moment from 'moment-timezone';
import {CronMonitorEnvironmentFixture} from 'sentry-fixture/detectors';
import {MonitorFixture} from 'sentry-fixture/monitor';

import type {Monitor} from 'sentry/views/insights/crons/types';
import {MonitorStatus} from 'sentry/views/insights/crons/types';

import {getAggregateEnvStatus, getMonitorRefetchInterval} from './utils';

describe('getAggregateEnvStatus', () => {
  it('returns ERROR when any environment has ERROR status', () => {
    const environments = [
      CronMonitorEnvironmentFixture({status: MonitorStatus.OK}),
      CronMonitorEnvironmentFixture({status: MonitorStatus.ERROR}),
      CronMonitorEnvironmentFixture({status: MonitorStatus.ACTIVE}),
    ];

    expect(getAggregateEnvStatus(environments)).toBe(MonitorStatus.ERROR);
  });

  it('returns OK when all environments are OK or ACTIVE', () => {
    const environments = [
      CronMonitorEnvironmentFixture({status: MonitorStatus.OK}),
      CronMonitorEnvironmentFixture({status: MonitorStatus.ACTIVE}),
    ];

    expect(getAggregateEnvStatus(environments)).toBe(MonitorStatus.OK);
  });

  it('returns ACTIVE when no environments have ERROR or OK status', () => {
    const environments = [
      CronMonitorEnvironmentFixture({status: MonitorStatus.ACTIVE}),
      CronMonitorEnvironmentFixture({status: MonitorStatus.DISABLED}),
    ];

    expect(getAggregateEnvStatus(environments)).toBe(MonitorStatus.ACTIVE);
  });

  it('returns ACTIVE for empty array', () => {
    expect(getAggregateEnvStatus([])).toBe(MonitorStatus.ACTIVE);
  });
});

describe('getMonitorRefetchInterval', () => {
  function makeMonitorWithNextCheckIns(nextCheckIns: Array<string | null>): Monitor {
    return MonitorFixture({
      environments: nextCheckIns.map(nextCheckIn =>
        CronMonitorEnvironmentFixture({nextCheckIn})
      ),
    });
  }

  it('returns WAITING_FIRST_CHECK_IN_INTERVAL_MS when no environments exist', () => {
    const now = moment('2024-01-01T12:00:00Z').toDate();
    const monitor = makeMonitorWithNextCheckIns([]);

    expect(getMonitorRefetchInterval(monitor, now)).toBe(5_000);
  });

  it('returns time until nextCheckIn when it is in the future', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const futureTime = moment(now).add(10, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([futureTime.toISOString()]);

    const result = getMonitorRefetchInterval(monitor, now.toDate());
    // Should be exactly 10 minutes (600_000ms)
    expect(result).toBe(600_000);
  });

  it('returns 5 seconds when check-in is less than 1 minute late', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const pastTime = moment(now).subtract(30, 'seconds');
    const monitor = makeMonitorWithNextCheckIns([pastTime.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(5_000);
  });

  it('returns 5 seconds when check-in is exactly now', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const monitor = makeMonitorWithNextCheckIns([now.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(5_000);
  });

  it('returns 30 seconds when check-in is 1-5 minutes late', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const pastTime = moment(now).subtract(3, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([pastTime.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(30_000);
  });

  it('returns 2 minutes when check-in is 5-15 minutes late', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const pastTime = moment(now).subtract(10, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([pastTime.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(2 * 60_000);
  });

  it('returns 5 minutes when check-in is 15-30 minutes late', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const pastTime = moment(now).subtract(20, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([pastTime.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(5 * 60_000);
  });

  it('returns 10 minutes (cap) when check-in is more than 30 minutes late', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const pastTime = moment(now).subtract(2, 'hours');
    const monitor = makeMonitorWithNextCheckIns([pastTime.toISOString()]);

    expect(getMonitorRefetchInterval(monitor, now.toDate())).toBe(10 * 60_000);
  });

  it('uses the earliest nextCheckIn when multiple environments exist', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const earlierTime = moment(now).add(5, 'minutes');
    const laterTime = moment(now).add(10, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([
      laterTime.toISOString(),
      earlierTime.toISOString(),
    ]);

    const result = getMonitorRefetchInterval(monitor, now.toDate());
    // Should be exactly 5 minutes (300_000ms)
    expect(result).toBe(300_000);
  });

  it('handles environment with null nextCheckIn among others', () => {
    const now = moment('2024-01-01T12:00:00Z');
    const futureTime = moment(now).add(10, 'minutes');
    const monitor = makeMonitorWithNextCheckIns([null, futureTime.toISOString()]);

    const result = getMonitorRefetchInterval(monitor, now.toDate());
    // Should use the non-null nextCheckIn
    expect(result).toBe(600_000);
  });
});
