import type {IncidentCase} from 'sentry/views/incidents/types';

export function getIncidentLabel(incident: IncidentCase) {
  return `${incident.template.case_handle}-${incident.id}`;
}

export function getIncidentSeverity(incident: IncidentCase) {
  return `${incident.template.severity_handle}${incident.severity}`;
}
