import {Client} from 'sentry/api';

import {MetricRule, SavedMetricRule} from './types';

function isSavedRule(rule: MetricRule): rule is SavedMetricRule {
  return !!rule.id;
}

/**
 * Add a new rule or update an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 * @param query Query parameters for the request eg - referrer
 */
export async function addOrUpdateRule(
  api: Client,
  orgId: string,
  projectId: string,
  rule: MetricRule,
  query?: object | any
) {
  const isExisting = isSavedRule(rule);
  const endpoint = `/projects/${orgId}/${projectId}/alert-rules/${
    isSavedRule(rule) ? `${rule.id}/` : ''
  }`;
  const method = isExisting ? 'PUT' : 'POST';

  return api.requestPromise(endpoint, {
    method,
    data: rule,
    query,
    includeAllArgs: true,
  });
}

/**
 * Delete an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 */
export function deleteRule(
  api: Client,
  orgId: string,
  rule: SavedMetricRule
): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
