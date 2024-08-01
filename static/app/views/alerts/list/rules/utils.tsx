import {type CombinedMetricIssueAlerts, IncidentStatus} from 'sentry/views/alerts/types';

export function hasActiveIncident(rule: CombinedMetricIssueAlerts): boolean {
  return (
    rule.latestIncident?.status !== undefined &&
    [IncidentStatus.CRITICAL, IncidentStatus.WARNING].includes(rule.latestIncident.status)
  );
}
