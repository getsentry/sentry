import {Client} from 'sentry/api';
import {MetricRule} from 'sentry/views/alerts/rules/metric/types';

import type {Incident} from '../types';

// Use this api for requests that are getting cancelled
const uncancellableApi = new Client();

export function fetchAlertRule(
  orgId: string,
  ruleId: string,
  query?: Record<string, string>
): Promise<MetricRule> {
  return uncancellableApi.requestPromise(
    `/organizations/${orgId}/alert-rules/${ruleId}/`,
    {query}
  );
}

export function fetchIncidentsForRule(
  orgId: string,
  alertRule: string,
  start: string,
  end: string
): Promise<Incident[]> {
  return uncancellableApi.requestPromise(`/organizations/${orgId}/incidents/`, {
    query: {
      project: '-1',
      alertRule,
      includeSnapshots: true,
      start,
      end,
      expand: ['activities', 'seen_by', 'original_alert_rule'],
    },
  });
}

export function fetchIncident(
  api: Client,
  orgId: string,
  alertId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}
