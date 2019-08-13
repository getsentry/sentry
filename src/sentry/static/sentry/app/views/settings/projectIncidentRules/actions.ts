import {IncidentRule} from './types';
import {Client} from 'app/api';

// TODO(ts): type response
export function deleteRule(
  api: Client,
  orgId: string,
  projectId: string,
  rule: IncidentRule
): Promise<any> {
  return api.requestPromise(`/projects/${orgId}/${projectId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
