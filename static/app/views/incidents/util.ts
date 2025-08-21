import type {IncidentCase} from 'sentry/views/incidents/types';

export function getIncidentLabel(incident: IncidentCase) {
  return `${incident.template.case_handle}-${incident.id}`;
}

export function getIncidentSeverity(incident: IncidentCase) {
  return `${incident.template.severity_handle}${incident.severity}`;
}

export function getSeverityColor(incident: IncidentCase) {
  return [
    {text: '#8A2323', border: '#F5B3B3', background: '#FFE5E5'},
    {text: '#A04D1A', border: '#FFD2A6', background: '#FFEAD6'},
    {text: '#A0871A', border: '#FFEB99', background: '#FFF5D6'},
    {text: '#8A8A23', border: '#F5F5B3', background: '#FFFBE5'},
    {text: '#5A8C23', border: '#D6F5B3', background: '#F5FFE5'},
  ][incident.severity];
}

export function getStatusColor(
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
) {
  return {
    investigating: {text: '#6C3FC5', border: '#D1B3F5', background: '#F3E9FF'},
    identified: {text: '#3F6CC5', border: '#B3D1F5', background: '#E9F3FF'},
    monitoring: {text: '#239C8A', border: '#B3F5E3', background: '#E5FFFA'},
    resolved: {text: '#238C5A', border: '#B3F5D6', background: '#E5FFF5'},
  }[status];
}
