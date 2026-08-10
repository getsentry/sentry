import {Client} from 'sentry/api';
import type {Incident} from 'sentry/views/alerts/types';

export function fetchIncident(
  api: Client,
  orgId: string,
  alertId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}
