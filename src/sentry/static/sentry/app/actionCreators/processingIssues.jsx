export function fetchProcessingIssues(api, orgId, projectIds = null) {
  let query = null;
  if (projectIds) {
    query = {project: projectIds};
  }
  return api.requestPromise(`/organizations/${orgId}/processingissues/`, {
    method: 'GET',
    query,
  });
}
