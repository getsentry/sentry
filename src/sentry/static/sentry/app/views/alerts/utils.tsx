import {Client} from 'app/api';

import {Incident, IncidentStats, IncidentStatus} from './types';

export function fetchIncident(
  api: Client,
  orgId: string,
  alertId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}

export function fetchIncidentStats(
  api: Client,
  orgId: string,
  alertId: string
): Promise<IncidentStats> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/stats/`);
}

export function updateSubscription(
  api: Client,
  orgId: string,
  alertId: string,
  isSubscribed?: boolean
): Promise<Incident> {
  const method = isSubscribed ? 'POST' : 'DELETE';
  return api.requestPromise(
    `/organizations/${orgId}/incidents/${alertId}/subscriptions/`,
    {
      method,
    }
  );
}

export function updateStatus(
  api: Client,
  orgId: string,
  alertId: string,
  status: IncidentStatus
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`, {
    method: 'PUT',
    data: {
      status,
    },
  });
}

/**
 * Is incident open?
 *
 * @param {Object} incident Incident object
 * @returns {Boolean}
 */

export function isOpen(incident: Incident): boolean {
  switch (incident.status) {
    case IncidentStatus.CLOSED:
      return false;
    default:
      return true;
  }
}
