import {Client} from 'app/api';

import {SavedIncidentRule, IncidentRule} from './types';

function isSavedRule(rule: IncidentRule): rule is SavedIncidentRule {
  return !!rule.id;
}

/**
 * Add a new rule or update an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 */
export async function addOrUpdateRule(
  api: Client,
  orgId: string,
  projectId: string,
  rule: IncidentRule
): Promise<unknown[]> {
  const isExisting = isSavedRule(rule);
  const endpoint = `/projects/${orgId}/${projectId}/alert-rules/${
    isSavedRule(rule) ? `${rule.id}/` : ''
  }`;
  const method = isExisting ? 'PUT' : 'POST';

  return api.requestPromise(endpoint, {
    method,
    data: rule,
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
  rule: SavedIncidentRule
): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
