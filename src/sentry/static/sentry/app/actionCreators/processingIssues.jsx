export function fetchProcessingIssues(api, orgId, projectIds = null) {
  return api.requestPromise(`/organizations/${orgId}/processingissues/`, {
    method: 'GET',
    query: projectIds ? {project: projectIds} : null,
  });
}
