import {Query} from 'history';
import chunk from 'lodash/chunk';
import debounce from 'lodash/debounce';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import LatestContextStore from 'sentry/stores/latestContextStore';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {PlatformKey, Project, Team} from 'sentry/types';

type UpdateParams = {
  orgId: string;
  projectId: string;
  data?: {[key: string]: any};
  query?: Query;
};

export function update(api: Client, params: UpdateParams) {
  ProjectsStatsStore.onUpdate(params.projectId, params.data as Partial<Project>);

  const endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  return api
    .requestPromise(endpoint, {
      method: 'PUT',
      data: params.data,
    })
    .then(
      data => {
        ProjectsStore.onUpdateSuccess(data);
        return data;
      },
      err => {
        ProjectsStatsStore.onUpdateError(err, params.projectId);
        throw err;
      }
    );
}

type StatsParams = Pick<UpdateParams, 'orgId' | 'data' | 'query'>;

export function loadStats(api: Client, params: StatsParams) {
  const endpoint = `/organizations/${params.orgId}/stats/`;
  api.request(endpoint, {
    query: params.query,
    success: data => ProjectsStore.onStatsLoadSuccess(data),
  });
}

// This is going to queue up a list of project ids we need to fetch stats for
// Will be cleared when debounced function fires
const _projectStatsToFetch: Set<string> = new Set();

// Max projects to query at a time, otherwise if we fetch too many in the same request
// it can timeout
const MAX_PROJECTS_TO_FETCH = 10;

const _queryForStats = (
  api: Client,
  projects: string[],
  orgId: string,
  additionalQuery: Query | undefined
) => {
  const idQueryParams = projects.map(project => `id:${project}`).join(' ');
  const endpoint = `/organizations/${orgId}/projects/`;

  const query: Query = {
    statsPeriod: '24h',
    query: idQueryParams,
    ...additionalQuery,
  };

  return api.requestPromise(endpoint, {
    query,
  });
};

export const _debouncedLoadStats = debounce(
  (api: Client, projectSet: Set<string>, params: UpdateParams) => {
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
      _queryForStats(api, chunkedProjects, params.orgId, params.query)
    );

    Promise.all(queries)
      .then(results => {
        ProjectsStatsStore.onStatsLoadSuccess(
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
  LatestContextStore.onSetActiveProject(project);
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
        let message = '';
        // Handle errors with known failures
        if (err.status >= 400 && err.status < 500 && err.responseJSON) {
          message = err.responseJSON?.detail;
        }

        if (message) {
          addErrorMessage(
            tct('Error transferring [project]. [message]', {
              project: project.slug,
              message,
            })
          );
        } else {
          addErrorMessage(
            tct('Error transferring [project]', {
              project: project.slug,
            })
          );
        }

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
        ProjectsStore.onAddTeam(team, projectSlug);
        ProjectsStore.onUpdateSuccess(project);
      },
      err => {
        addErrorMessage(
          tct('Unable to add [team] to the [project] project', {
            team: `#${team.slug}`,
            project: projectSlug,
          })
        );
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
        ProjectsStore.onRemoveTeam(teamSlug, projectSlug);
        ProjectsStore.onUpdateSuccess(project);
      },
      err => {
        addErrorMessage(
          tct('Unable to remove [team] from the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          })
        );
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
  ProjectsStore.onChangeSlug(prev, next);
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
export function createProject({
  api,
  name,
  options = {},
  orgSlug,
  platform,
  team,
}: {
  api: Client;
  name: string;
  options: {defaultRules?: boolean};
  orgSlug: string;
  platform: string;
  team: string;
}) {
  return api.requestPromise(`/teams/${orgSlug}/${team}/projects/`, {
    method: 'POST',
    data: {name, platform, default_rules: options.defaultRules},
  });
}

/**
 * Deletes a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 */
export function removeProject({
  api,
  orgSlug,
  projectSlug,
  origin,
}: {
  api: Client;
  orgSlug: string;
  origin: 'onboarding' | 'settings' | 'getting_started';
  projectSlug: Project['slug'];
}) {
  return api.requestPromise(`/projects/${orgSlug}/${projectSlug}/`, {
    method: 'DELETE',
    data: {origin},
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
export function loadDocs({
  api,
  orgSlug,
  projectSlug,
  platform,
}: {
  api: Client;
  orgSlug: string;
  platform: PlatformKey | 'python-tracing' | 'node-tracing' | 'react-native-tracing';
  projectSlug: string;
}) {
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

/**
 * Check if there are any releases in the last 90 days.
 * Used for checking if project is using releases.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectId Project Id
 */
export async function fetchAnyReleaseExistence(
  api: Client,
  orgSlug: string,
  projectId: number | string
) {
  const data = await api.requestPromise(`/organizations/${orgSlug}/releases/stats/`, {
    method: 'GET',
    query: {
      statsPeriod: '90d',
      project: projectId,
      per_page: 1,
    },
  });

  return data.length > 0;
}
