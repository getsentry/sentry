import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import OrganizationActions from 'app/actions/organizationActions';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import {Client} from 'app/api';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import {Organization, Project, Team} from 'app/types';

async function fetchOrg(
  api: Client,
  slug: string,
  detailed: boolean
): Promise<Organization> {
  const org = await api.requestPromise(`/organizations/${slug}/`, {
    query: {detailed: detailed ? 1 : 0},
  });

  if (!org) {
    throw new Error('retrieved organization is falsey');
  }

  OrganizationActions.update(org, {replace: true});
  setActiveOrganization(org);

  return org;
}

async function fetchProjectsAndTeams(slug: string): Promise<[Project[], Team[]]> {
  // Create a new client so the request is not cancelled
  const uncancelableApi = new Client();
  try {
    const [projects, teams] = await Promise.all([
      uncancelableApi.requestPromise(`/organizations/${slug}/projects/`, {
        query: {
          all_projects: 1,
          collapse: 'latestDeploys',
        },
      }),
      uncancelableApi.requestPromise(`/organizations/${slug}/teams/`),
    ]);

    return [projects, teams];
  } catch (err) {
    // It's possible these requests fail with a 403 if the user has a role with insufficient access
    // to projects and teams, but *can* access org details (e.g. billing).
    // An example of this is in org settings.
    //
    // Ignore 403s and bubble up other API errors
    if (err.status !== 403) {
      throw err;
    }
  }
  return [[], []];
}

/**
 * Fetches an organization's details with an option for the detailed representation
 * with teams and projects
 *
 * @param api A reference to the api client
 * @param slug The organization slug
 * @param detailed Whether or not the detailed org details should be retrieved
 * @param silent Should we silently update the organization (do not clear the
 *               current organization in the store)
 */
export async function fetchOrganizationDetails(
  api: Client,
  slug: string,
  detailed: boolean,
  silent: boolean
) {
  if (!silent) {
    OrganizationActions.fetchOrg();
    ProjectActions.reset();
    GlobalSelectionActions.reset();
  }

  try {
    const promises: Array<Promise<any>> = [fetchOrg(api, slug, detailed)];
    if (!detailed) {
      promises.push(fetchProjectsAndTeams(slug));
    }

    const [org, projectsAndTeams] = await Promise.all(promises);

    if (!detailed) {
      const [projects, teams] = projectsAndTeams as [Project[], Team[]];
      ProjectActions.loadProjects(projects);
      TeamActions.loadTeams(teams);
    }

    if (org && detailed) {
      // TODO(davidenwang): Change these to actions after organization.projects
      // and organization.teams no longer exists. Currently if they were changed
      // to actions it would cause OrganizationContext to rerender many times
      TeamStore.loadInitialData(org.teams);
      ProjectsStore.loadInitialData(org.projects);
    }
  } catch (err) {
    if (!err) {
      return;
    }

    OrganizationActions.fetchOrgError(err);

    if (err.status === 403 || err.status === 401) {
      const errMessage =
        typeof err.responseJSON?.detail === 'string'
          ? err.responseJSON?.detail
          : typeof err.responseJSON?.detail?.message === 'string'
          ? err.responseJSON?.detail.message
          : null;

      if (errMessage) {
        addErrorMessage(errMessage);
      }

      return;
    }

    Sentry.captureException(err);
  }
}
