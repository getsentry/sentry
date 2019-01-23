export function fetchSavedSearches(api, orgId, projectId = null) {
  let url = projectId
    ? `/projects/${orgId}/${projectId}/searches/`
    : `/organizations/${orgId}/searches/`;
  return api.requestPromise(url, {
    method: 'GET',
  });
}
