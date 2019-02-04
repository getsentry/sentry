export function promptsUpdate(api, params) {
  const endpoint = '/promptsactivity/';
  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: {
      organization_id: params.organizationId,
      project_id: params.projectId,
      feature: params.feature,
      status: params.status,
    },
  });
}
