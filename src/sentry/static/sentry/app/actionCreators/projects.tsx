import chunk from 'lodash/chunk';
import debounce from 'lodash/debounce';
import {Query} from 'history';

import {Client} from 'app/api';
import {PlatformKey} from 'app/data/platformCategories';
import {Project, Team} from 'app/types';
import {
  addLoadingMessage,
  addErrorMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';

type UpdateParams = {
  orgId: string;
  projectId: string;
  data?: {[key: string]: any};
  query?: Query;
};

export function update(api: Client, params: UpdateParams) {
  ProjectActions.update(params.projectId, params.data);

  const endpoint = `/projects/${params.orgId}/${params.projectId}/`;
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
        ProjectActions.updateError(err, params.projectId);
        throw err;
      }
    );
}

export function loadStats(api: Client, params: UpdateParams) {
  ProjectActions.loadStats(params.orgId, params.data);

  const endpoint = `/organizations/${params.orgId}/stats/`;
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

// This is going to queue up a list of project ids we need to fetch stats for
// Will be cleared when debounced function fires
const _projectStatsToFetch: Set<string> = new Set();

// Max projects to query at a time, otherwise if we fetch too many in the same request
// it can timeout
const MAX_PROJECTS_TO_FETCH = 10;

const _queryForStats = (api: Client, projects: string[], orgId: string) => {
  const idQueryParams = projects.map(project => `id:${project}`).join(' ');
  const endpoint = `/organizations/${orgId}/projects/`;

  return api.requestPromise(endpoint, {
    query: {
      statsPeriod: '24h',
      query: idQueryParams,
    },
  });
};

export const _debouncedLoadStats = debounce(
  (api: Client, projectSet: Set<string>, params) => {
    const storedProjects: {[key: string]: Project} = ProjectsStatsStore.getAll();
    const existingProjectStats = Object.values(storedProjects).map(({id}) => id);
    const projects = Array.from(projectSet).filter(
      project => !existingProjectStats.includes(project)
    );

    if (!projects.length) {
      _projectStatsToFetch.clear();
      return;
    }

    // Split projects into more manageable chunks to query, otherwise we can
    // potentially face server timeouts
    const queries = chunk(projects, MAX_PROJECTS_TO_FETCH).map(chunkedProjects =>
      _queryForStats(api, chunkedProjects, params.orgId)
    );

    Promise.all(queries)
      .then(results => {
        ProjectActions.loadStatsForProjectSuccess(
          results.reduce((acc, result) => acc.concat(result), [])
        );
      })
      .catch(() => {
        addErrorMessage(t('Unable to fetch all project stats'));
      });

    // Reset projects list
    _projectStatsToFetch.clear();
  },
  50
);

export function loadStatsForProject(api: Client, project: string, params: UpdateParams) {
  // Queue up a list of projects that we need stats for
  // and call a debounced function to fetch stats for list of projects
  _projectStatsToFetch.add(project);
  _debouncedLoadStats(api, _projectStatsToFetch, params);
}

export function setActiveProject(project: Project | null) {
  ProjectActions.setActive(project);
}

export function removeProject(api: Client, orgId: string, project: Project) {
  const endpoint = `/projects/${orgId}/${project.slug}/`;

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

export function transferProject(
  api: Client,
  orgId: string,
  project: Project,
  email: string
) {
  const endpoint = `/projects/${orgId}/${project.slug}/transfer/`;

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

/**
 *  Adds a team to a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param team Team data object
 */
export function addTeamToProject(
  api: Client,
  orgSlug: string,
  projectSlug: string,
  team: Team
) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${team.slug}/`;

  addLoadingMessage();
  ProjectActions.addTeam(team);

  return api
    .requestPromise(endpoint, {
      method: 'POST',
    })
    .then(
      project => {
        addSuccessMessage(
          tct('[team] has been added to the [project] project', {
            team: `#${team.slug}`,
            project: projectSlug,
          })
        );
        ProjectActions.addTeamSuccess(team, projectSlug);
        ProjectActions.updateSuccess(project);
      },
      err => {
        addErrorMessage(
          tct('Unable to add [team] to the [project] project', {
            team: `#${team.slug}`,
            project: projectSlug,
          })
        );
        ProjectActions.addTeamError();
        throw err;
      }
    );
}

/**
 * Removes a team from a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param teamSlug Team Slug
 */
export function removeTeamFromProject(
  api: Client,
  orgSlug: string,
  projectSlug: string,
  teamSlug: string
) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${teamSlug}/`;

  addLoadingMessage();
  ProjectActions.removeTeam(teamSlug);

  return api
    .requestPromise(endpoint, {
      method: 'DELETE',
    })
    .then(
      project => {
        addSuccessMessage(
          tct('[team] has been removed from the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          })
        );
        ProjectActions.removeTeamSuccess(teamSlug, projectSlug);
        ProjectActions.updateSuccess(project);
      },
      err => {
        addErrorMessage(
          tct('Unable to remove [team] from the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          })
        );
        ProjectActions.removeTeamError(err);
        throw err;
      }
    );
}

/**
 * Change a project's slug
 *
 * @param prev Previous slug
 * @param next New slug
 */
export function changeProjectSlug(prev: string, next: string) {
  ProjectActions.changeSlug(prev, next);
}

/**
 * Send a sample event
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 */
export function sendSampleEvent(api: Client, orgSlug: string, projectSlug: string) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/create-sample/`;

  return api.requestPromise(endpoint, {
    method: 'POST',
  });
}

/**
 * Creates a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param team The team slug to assign the project to
 * @param name Name of the project
 * @param platform The platform key of the project
 * @param options Additional options such as creating default alert rules
 */
export function createProject(
  api: Client,
  orgSlug: string,
  team: string,
  name: string,
  platform: string,
  options: {defaultRules?: boolean} = {}
) {
  return api.requestPromise(`/teams/${orgSlug}/${team}/projects/`, {
    method: 'POST',
    data: {name, platform, default_rules: options.defaultRules},
  });
}

/**
 * Load platform documentation specific to the project. The DSN and various
 * other project specific secrets will be included in the documentation.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param platform Project platform.
 */
export function loadDocs(
  api: Client,
  orgSlug: string,
  projectSlug: string,
  platform: PlatformKey
) {
  return api.requestPromise(`/projects/${orgSlug}/${projectSlug}/docs/${platform}/`);
}

/**
 * Load the counts of my projects and all projects for the current user
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 */
export function fetchProjectsCount(api: Client, orgSlug: string) {
  return api.requestPromise(`/organizations/${orgSlug}/projects-count/`);
}
