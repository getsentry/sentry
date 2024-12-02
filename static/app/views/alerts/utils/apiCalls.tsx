import {Client} from 'sentry/api';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

import type {Anomaly, Incident} from '../types';

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
  ruleId: string,
  start: string,
  end: string
): Promise<Incident[]> {
  return uncancellableApi.requestPromise(`/organizations/${orgId}/incidents/`, {
    query: {
      project: '-1',
      alertRule: ruleId,
      includeSnapshots: true,
      start,
      end,
      expand: ['activities', 'original_alert_rule'],
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

export function fetchAnomaliesForRule(
  orgId: string,
  ruleId: string,
  start: string,
  end: string
): Promise<Anomaly[]> {
  return uncancellableApi.requestPromise(
    `/organizations/${orgId}/alert-rules/${ruleId}/anomalies/`,
    {
      query: {
        start,
        end,
      },
    }
  );
}
