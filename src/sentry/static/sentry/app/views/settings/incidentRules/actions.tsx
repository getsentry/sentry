import {Client} from 'app/api';
import {IncidentRule} from './constants';

export function deleteRule(
  api: Client,
  orgId: string,
  rule: IncidentRule
): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
