import type {Actor} from 'sentry/types/core';
import {
  type CombinedAlerts,
  CombinedAlertType,
  type CombinedMetricIssueAlerts,
  IncidentStatus,
} from 'sentry/views/alerts/types';

export function hasActiveIncident(rule: CombinedMetricIssueAlerts): boolean {
  return (
    rule.latestIncident?.status !== undefined &&
    [IncidentStatus.CRITICAL, IncidentStatus.WARNING].includes(rule.latestIncident.status)
  );
}

export function getActor(rule: CombinedAlerts): Actor | null {
  if (rule.type === CombinedAlertType.UPTIME) {
    return rule.owner;
  }
  if (rule.type === CombinedAlertType.CRONS) {
    return rule.owner;
  }

  const ownerId = rule.owner?.split(':')[1];
  return ownerId ? {type: 'team' as Actor['type'], id: ownerId, name: ''} : null;
}
