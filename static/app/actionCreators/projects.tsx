import {queryOptions, skipToken, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {tct, t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

export function transferProject(
  api: Client,
  orgId: string,
  project: Project,
  email: string
) {
  const endpoint = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transfer/',
    {
      path: {organizationIdOrSlug: orgId, projectIdOrSlug: project.slug},
    }
  );

  return api
    .requestPromise(endpoint, {
      method: 'POST',
      data: {
        email,
      },
    })
    .then(
      () => {
        toast.success(
          tct('A request was sent to move [project] to a different organization', {
            project: project.slug,
          })
        );
      },
      (err: RequestError) => {
        let message = '';
        const detail = err.responseJSON?.detail;
        // Handle errors with known failures
        if (
          err.status &&
          err.status >= 400 &&
          err.status < 500 &&
          typeof detail === 'string'
        ) {
          message = detail;
        }

        if (message) {
          toast.error(
            tct('Error transferring [project]. [message]', {
              project: project.slug,
              message,
            })
          );
        } else {
          toast.error(
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
  const endpoint = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/$teamIdOrSlug/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        teamIdOrSlug: team.slug,
      },
    }
  );

  toast.loading(t('Saving changes...'));

  return api
    .requestPromise(endpoint, {
      method: 'POST',
    })
    .then(
      project => {
        toast.success(
          tct('[team] has been added to the [project] project', {
            team: `#${team.slug}`,
            project: projectSlug,
          })
        );
        ProjectsStore.onAddTeam(team, projectSlug);
        ProjectsStore.onUpdateSuccess(project);
      },
      err => {
        toast.error(
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
  const endpoint = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/$teamIdOrSlug/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        teamIdOrSlug: teamSlug,
      },
    }
  );

  toast.loading(t('Saving changes...'));

  return api
    .requestPromise(endpoint, {
      method: 'DELETE',
    })
    .then(
      project => {
        toast.success(
          tct('[team] has been removed from the [project] project', {
            team: `#${teamSlug}`,
            project: projectSlug,
          })
        );
        ProjectsStore.onRemoveTeam(teamSlug, projectSlug);
        ProjectsStore.onUpdateSuccess(project);
      },
      err => {
        toast.error(
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
  const response = await api.requestPromise(
    getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
    }),
    {
      method: 'DELETE',
      data: {origin},
    }
  );
  ProjectsStore.onDeleteProject(projectSlug);

  return response;
}

/**
 * Load the counts of my projects and all projects for the current user
 */
export function fetchProjectsCount(api: Client, orgSlug: string) {
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/projects-count/', {
      path: {organizationIdOrSlug: orgSlug},
    })
  );
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
