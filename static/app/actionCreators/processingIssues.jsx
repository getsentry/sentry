export function fetchProcessingIssues(api, orgId, projectIds = null) {
  return api.requestPromise(`/organizations/${orgId}/processingissues/`, {
    method: 'GET',
    query: projectIds ? {project: projectIds} : null,
  });
}

export function fetchProjectProcessingIssues(api, orgId, projectId) {
  // Use the project based endpoint as there is a permissions issue in the backend
  // and calling the old endpoint is a simple short term solution.
  return api
    .requestPromise(`/projects/${orgId}/${projectId}/processingissues/`)
    .then(data => {
      // Normalize data to match what the organization endpoint would return
      data.project = projectId;
      return [data];
    });
}
