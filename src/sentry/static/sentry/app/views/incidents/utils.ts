import {Client} from 'app/api';

import {Incident} from './types';

export enum IncidentActivityType {
  CREATED,
  DETECTED,
  STATUS_CHANGE,
  COMMENT,
}

export enum IncidentStatus {
  DETECTED,
  CREATED,
  CLOSED,
}

export function fetchIncident(
  api: Client,
  orgId: string,
  incidentId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`);
}

export function updateSubscription(
  api: Client,
  orgId: string,
  incidentId: string,
  isSubscribed?: boolean
): Promise<Incident> {
  const method = isSubscribed ? 'POST' : 'DELETE';
  return api.requestPromise(
    `/organizations/${orgId}/incidents/${incidentId}/subscriptions/`,
    {
      method,
    }
  );
}

export function updateStatus(
  api: Client,
  orgId: string,
  incidentId: string,
  status: IncidentStatus
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${incidentId}/`, {
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
    case IncidentStatus.DETECTED:
    case IncidentStatus.CREATED:
    default:
      return true;
  }
}
