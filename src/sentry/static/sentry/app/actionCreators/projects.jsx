import ProjectActions from '../actions/projectActions';

export function update(api, params) {
  ProjectActions.update(params.projectId, params.data);

  let endpoint = '/projects/' + params.orgId + '/' + params.projectId + '/';
  api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: function (changeId) {
      ProjectActions.updateSuccess(changeId);
    },
    error: function (changeId) {
      ProjectActions.updateError(changeId);
    }
  });
}
