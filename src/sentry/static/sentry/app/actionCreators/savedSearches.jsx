export function fetchSavedSearches(api, orgId, useOrgSavedSearches = false) {
  const url = `/organizations/${orgId}/searches/`;

  const data = {};
  if (useOrgSavedSearches) {
    data.use_org_level = '1';
  }

  return api.requestPromise(url, {
    method: 'GET',
    data,
  });
}

export function fetchProjectSavedSearches(api, orgId, projectId) {
  const url = `/projects/${orgId}/${projectId}/searches/`;
  return api.requestPromise(url, {
    method: 'GET',
  });
}
