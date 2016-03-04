import ProjectActions from '../actions/projectActions';

export function update(api, params) {
  ProjectActions.update(params.projectId, params.data);

  let endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: (data) => {
      ProjectActions.updateSuccess(data);
    },
    error: (data) => {
      ProjectActions.updateError(data);
    }
  });
}

export function loadStats(api, params) {
  ProjectActions.loadStats(params.orgId, params.data);

  let endpoint = `/organizations/${params.orgId}/stats/`;
  api.request(endpoint, {
    query: params.query,
    success: (data) => {
      ProjectActions.loadStatsSuccess(data);
    },
    error: (data) => {
      ProjectActions.loadStatsError(data);
    }
  });
}
