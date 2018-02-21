import {addErrorMessage, addSuccessMessage} from './indicator';
import {tct} from '../locale';
import ProjectActions from '../actions/projectActions';

export function update(api, params) {
  ProjectActions.update(params.projectId, params.data);

  let endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: data => {
      ProjectActions.updateSuccess(data);
    },
    error: data => {
      ProjectActions.updateError(data);
    },
  });
}

export function loadStats(api, params) {
  ProjectActions.loadStats(params.orgId, params.data);

  let endpoint = `/organizations/${params.orgId}/stats/`;
  api.request(endpoint, {
    query: params.query,
    success: data => {
      ProjectActions.loadStatsSuccess(data);
    },
    error: data => {
      ProjectActions.loadStatsError(data);
    },
  });
}

export function setActiveProject(project) {
  ProjectActions.setActive(project);
}

export function removeProject(api, orgId, project) {
  let endpoint = `/projects/${orgId}/${project.slug}/`;

  ProjectActions.removeProject(project);
  let req = api
    .requestPromise(endpoint, {
      method: 'DELETE',
    })
    .then(
      () => {
        ProjectActions.removeProjectSuccess(project);
        addSuccessMessage(
          tct('[project] was successfully removed', {project: project.slug})
        );
      },
      () => {
        ProjectActions.removeProjectError(project);
        addErrorMessage(tct('Error removing [project]', {project: project.slug}));
      }
    );

  return req;
}

export function transferProject(api, orgId, project, email) {
  let endpoint = `/projects/${orgId}/${project.slug}/transfer/`;

  let req = api
    .requestPromise(endpoint, {
      method: 'POST',
      data: {
        email,
      },
    })
    .then(
      () => {
        addSuccessMessage(
          tct('A request was sent to move [project] to a different organization', {
            project: project.slug,
          })
        );
      },
      () => {
        addErrorMessage(tct('Error transferring [project]', {project: project.slug}));
      }
    );

  return req;
}
