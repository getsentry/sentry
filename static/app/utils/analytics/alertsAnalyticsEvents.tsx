import type {UptimeMonitorMode} from 'sentry/views/detectors/components/uptime/types';

export type AlertsEventParameters = {
  'uptime_monitor.created': {
    uptime_mode: UptimeMonitorMode;
  };
};

type AlertsEventKey = keyof AlertsEventParameters;

export const alertsEventMap: Record<AlertsEventKey, string | null> = {
  'uptime_monitor.created': 'Uptime Monitor Created',
};
