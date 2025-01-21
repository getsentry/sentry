import {type MonitorEnvironment, MonitorStatus} from 'sentry/views/monitors/types';

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
