import {IncidentRule} from './types';

// TODO(ts): type api and response
export function deleteRule(
  api: any,
  orgId: string,
  projectId: string,
  rule: IncidentRule
): Promise<any> {
  return api.requestPromise(`/projects/${orgId}/${projectId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}
