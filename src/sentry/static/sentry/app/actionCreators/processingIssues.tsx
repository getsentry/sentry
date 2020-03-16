import {Client} from 'app/api';

export function fetchProcessingIssues(
  api: Client,
  orgId: string,
  projectIds: string[] | null = null
) {
  return api.requestPromise(`/organizations/${orgId}/processingissues/`, {
    method: 'GET',
    query: projectIds ? {project: projectIds} : [],
  });
}
