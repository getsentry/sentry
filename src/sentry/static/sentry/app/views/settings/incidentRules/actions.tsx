import {Client} from 'app/api';
import {IncidentRule, Trigger} from './types';

export function deleteRule(
  api: Client,
  orgId: string,
  rule: IncidentRule
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
