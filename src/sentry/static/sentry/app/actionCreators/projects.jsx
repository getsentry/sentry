import {addErrorMessage, addSuccessMessage} from './indicator';
import {tct} from '../locale';
import ProjectActions from '../actions/projectActions';

export function update(api, params) {
  ProjectActions.update(params.projectId, params.data);

  let endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  return api
    .requestPromise(endpoint, {
      method: 'PUT',
      data: params.data,
    })
    .then(
      data => {
        ProjectActions.updateSuccess(data);
        return data;
      },
      err => {
        ProjectActions.updateError(err);
        throw err;
      }
    );
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
  return api
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
      err => {
        ProjectActions.removeProjectError(project);
        addErrorMessage(tct('Error removing [project]', {project: project.slug}));
        throw err;
      }
    );
}

export function transferProject(api, orgId, project, email) {
  let endpoint = `/projects/${orgId}/${project.slug}/transfer/`;

  return api
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
      err => {
        addErrorMessage(tct('Error transferring [project]', {project: project.slug}));
        throw err;
      }
    );
}

/**
 * Associate a team with a project
 */
export function addTeamToProject(api, orgSlug, projectSlug, teamSlug) {
  let endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${teamSlug}/`;

  return api
    .requestPromise(endpoint, {
      method: 'POST',
    })
    .then(
      () => {
        addSuccessMessage(
          tct('[team] has been added to the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          }),
          undefined,
          {append: true}
        );
      },
      err => {
        addErrorMessage(
          tct('Unable to add [team] to the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          }),
          undefined,
          {append: true}
        );
        throw err;
      }
    );
}
