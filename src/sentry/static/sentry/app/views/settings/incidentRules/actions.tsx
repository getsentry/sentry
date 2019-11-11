import {Client} from 'app/api';
import {SavedIncidentRule, Trigger} from './types';

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
