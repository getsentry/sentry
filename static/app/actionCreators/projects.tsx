import {queryOptions, skipToken, useQueryClient} from '@tanstack/react-query';
import type {Query} from 'history';
import chunk from 'lodash/chunk';
import debounce from 'lodash/debounce';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import {ProjectsStatsStore} from 'sentry/stores/projectsStatsStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

type UpdateParams = {
  orgId: string;
  projectId: string;
  data?: Record<string, any>;
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
      (err: Error) => {
        ProjectsStatsStore.onUpdateError(err, params.projectId);
        throw err;
      }
    );
}

// This is going to queue up a list of project ids we need to fetch stats for
// Will be cleared when debounced function fires
export const _projectStatsToFetch = new Set<string>();

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
    const storedProjects = ProjectsStatsStore.getAll();
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
      (err: RequestError) => {
        let message = '';
        // Handle errors with known failures
        if (err.status && err.status >= 400 && err.status < 500 && err.responseJSON) {
          message = err.responseJSON.detail as string;
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
 *  Adds a team to a project
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
 */
function removeTeamFromProject(
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
 */
export function changeProjectSlug(prev: string, next: string) {
  ProjectsStore.onChangeSlug(prev, next);
}

/**
 * Deletes a project
 */
export async function removeProject({
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
  const response = await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/`, {
    method: 'DELETE',
    data: {origin},
  });
  ProjectsStore.onDeleteProject(projectSlug);

  return response;
}

/**
 * Load the counts of my projects and all projects for the current user
 */
export function fetchProjectsCount(api: Client, orgSlug: string) {
  return api.requestPromise(`/organizations/${orgSlug}/projects-count/`);
}

export function projectTeamsApiOptions({
  orgSlug,
  projectSlug,
  cursor,
}: {
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
}) {
  return queryOptions({
    ...apiOptions.as<Team[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/',
      {
        path:
          orgSlug && projectSlug
            ? {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug}
            : skipToken,
        query: {cursor},
        staleTime: 0,
      }
    ),
    retry: false,
  });
}

export function useAddTeamToProject({
  orgSlug,
  projectSlug,
  cursor,
}: {
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {queryKey} = projectTeamsApiOptions({orgSlug, projectSlug, cursor});

  return async (team: Team) => {
    await addTeamToProject(api, orgSlug, projectSlug, team);

    queryClient.setQueryData(queryKey, prevData =>
      prevData ? {...prevData, json: [team, ...prevData.json]} : prevData
    );
  };
}

export function useRemoveTeamFromProject({
  orgSlug,
  projectSlug,
  cursor,
}: {
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {queryKey} = projectTeamsApiOptions({orgSlug, projectSlug, cursor});

  return async (teamSlug: string) => {
    await removeTeamFromProject(api, orgSlug, projectSlug, teamSlug);

    queryClient.setQueryData(queryKey, prevData =>
      prevData
        ? {...prevData, json: prevData.json.filter(team => team?.slug !== teamSlug)}
        : prevData
    );
  };
}
