import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import OrganizationActions from 'app/actions/organizationActions';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import {Client} from 'app/api';
import {Organization, Project, Team} from 'app/types';
import {getPreloadedDataPromise} from 'app/utils/getPreloadedData';

async function fetchOrg(
  api: Client,
  slug: string,
  isInitialFetch?: boolean
): Promise<Organization> {
  const org = await getPreloadedDataPromise(
    'organization',
    slug,
    () =>
      // This data should get preloaded in static/sentry/index.ejs
      // If this url changes make sure to update the preload
      api.requestPromise(`/organizations/${slug}/`, {query: {detailed: 0}}),
    isInitialFetch
  );

  if (!org) {
    throw new Error('retrieved organization is falsey');
  }

  OrganizationActions.update(org, {replace: true});
  setActiveOrganization(org);

  return org;
}

async function fetchProjectsAndTeams(
  slug: string,
  isInitialFetch?: boolean
): Promise<[Project[], Team[]]> {
  // Create a new client so the request is not cancelled
  const uncancelableApi = new Client();

  const projectsPromise = getPreloadedDataPromise(
    'projects',
    slug,
    () =>
      // This data should get preloaded in static/sentry/index.ejs
      // If this url changes make sure to update the preload
      uncancelableApi.requestPromise(`/organizations/${slug}/projects/`, {
        query: {
          all_projects: 1,
          collapse: 'latestDeploys',
        },
      }),
    isInitialFetch
  );

  const teamsPromise = getPreloadedDataPromise(
    'teams',
    slug,
    // This data should get preloaded in static/sentry/index.ejs
    // If this url changes make sure to update the preload
    () => uncancelableApi.requestPromise(`/organizations/${slug}/teams/`),
    isInitialFetch
  );

  try {
    return await Promise.all([projectsPromise, teamsPromise]);
  } catch (err) {
    // It's possible these requests fail with a 403 if the user has a role with
    // insufficient access to projects and teams, but *can* access org details
    // (e.g. billing). An example of this is in org settings.
    //
    // Ignore 403s and bubble up other API errors
    if (err.status !== 403) {
      throw err;
    }
  }

  return [[], []];
}

/**
 * Fetches an organization's details
 *
 * @param api A reference to the api client
 * @param slug The organization slug
 * @param silent Should we silently update the organization (do not clear the
 *               current organization in the store)
 */
export async function fetchOrganizationDetails(
  api: Client,
  slug: string,
  silent: boolean,
  isInitialFetch?: boolean
) {
  if (!silent) {
    OrganizationActions.fetchOrg();
    ProjectActions.reset();
    GlobalSelectionActions.reset();
  }

  const loadOrganization = async () => {
    try {
      await fetchOrg(api, slug, isInitialFetch);
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
  };

  const loadTeamsAndProjects = async () => {
    const [projects, teams] = await fetchProjectsAndTeams(slug, isInitialFetch);
    ProjectActions.loadProjects(projects);
    TeamActions.loadTeams(teams);
  };

  return Promise.all([loadOrganization(), loadTeamsAndProjects()]);
}
