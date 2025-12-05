import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import type {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import type {MonitorConfig} from 'sentry/views/insights/crons/types';

export type AlertsEventParameters = {
  'anomaly-detection.feedback-submitted': {
    choice_selected: boolean;
    incident_id: string;
  };
  'cron_monitor.created': {
    cron_schedule_type: MonitorConfig['schedule_type'];
  };
  'issue_alert_rule.created': Record<string, unknown>;
  'metric_alert_rule.created': {
    aggregate: MetricRule['aggregate'];
    dataset: MetricRule['dataset'];
  };
  'uptime_monitor.created': {
    uptime_mode: UptimeMonitorMode;
  };
};

type AlertsEventKey = keyof AlertsEventParameters;

export const alertsEventMap: Record<AlertsEventKey, string | null> = {
  'anomaly-detection.feedback-submitted': 'Anomaly Detection Feedback Submitted',
  'issue_alert_rule.created': 'Issue Alert Rule Created',
  'metric_alert_rule.created': 'Metric Alert Rule Created',
  'cron_monitor.created': 'Cron Monitor Created',
  'uptime_monitor.created': 'Uptime Monitor Created',
};
