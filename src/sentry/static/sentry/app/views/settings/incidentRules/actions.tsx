import {Client} from 'app/api';
import {IncidentRule} from './types';

export function deleteRule(
  api: Client,
  orgId: string,
  rule: IncidentRule
): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
