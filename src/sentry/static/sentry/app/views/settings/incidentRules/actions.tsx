import {Client} from 'app/api';
import {SavedIncidentRule, IncidentRule, Trigger} from './types';

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
  rule: IncidentRule
): Promise<unknown[]> {
  const isExisting = isSavedRule(rule);
  const endpoint = `/organizations/${orgId}/alert-rules/${
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

export function deleteTrigger(
  api: Client,
  orgId: string,
  trigger: Trigger
): Promise<void> {
  return api.requestPromise(
    `/organizations/${orgId}/alert-rules/${trigger.alertRuleId}/triggers/${trigger.id}`,
    {
      method: 'DELETE',
    }
  );
}
