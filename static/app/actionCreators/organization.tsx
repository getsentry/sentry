// XXX(epurkhiser): Ensure the LatestContextStore is initialized before we set
// the active org. Otherwise we will trigger an action that does nothing
import 'sentry/stores/latestContextStore';

import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {setActiveOrganization} from 'sentry/actionCreators/organizations';
import type {ApiResult} from 'sentry/api';
import {Client} from 'sentry/api';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import {
  addOrganizationFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type RequestError from 'sentry/utils/requestError/requestError';

async function fetchOrg(api: Client, slug: string): Promise<Organization> {
  const [org] = await api.requestPromise(`/organizations/${slug}/`, {
    includeAllArgs: true,
    query: {detailed: 0, include_feature_flags: 1},
  });

  if (!org) {
    throw new Error('retrieved organization is falsey');
  }

  FeatureFlagOverrides.singleton().loadOrg(org);
  addOrganizationFeaturesHandler({
    organization: org,
    handler: buildSentryFeaturesHandler('feature.organizations:'),
  });

  OrganizationStore.onUpdate(org, {replace: true});
  setActiveOrganization(org);

  const scope = Sentry.getCurrentScope();
  // XXX(dcramer): this is duplicated in sdk.py on the backend
  scope.setTag('organization', org.id);
  scope.setTag('organization.slug', org.slug);
  scope.setContext('organization', {id: org.id, slug: org.slug});

  return org;
}

async function fetchProjectsAndTeams(
  slug: string
): Promise<[ApiResult<Project[]>, ApiResult<Team[]>]> {
  // Create a new client so the request is not cancelled
  const uncancelableApi = new Client();

  const projectsPromise = uncancelableApi.requestPromise(
    `/organizations/${slug}/projects/`,
    {
      includeAllArgs: true,
      query: {
        all_projects: 1,
        collapse: ['latestDeploys', 'unusedFeatures'],
      },
    }
  );

  const teamsPromise = uncancelableApi.requestPromise(`/organizations/${slug}/teams/`, {
    includeAllArgs: true,
  });

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

  return [
    [[], undefined, undefined],
    [[], undefined, undefined],
  ];
}

/**
 * Fetches an organization's details
 *
 * @param api A reference to the api client
 * @param slug The organization slug
 * @param silent Should we silently update the organization (do not clear the
 *               current organization in the store)
 */
export async function fetchOrganizationDetails(api: Client, slug: string): Promise<void> {
  const getErrorMessage = (err: RequestError) => {
    if (typeof err.responseJSON?.detail === 'string') {
      return err.responseJSON?.detail;
    }
    if (typeof err.responseJSON?.detail?.message === 'string') {
      return err.responseJSON?.detail.message;
    }
    return null;
  };

  const loadOrganization = async () => {
    let org: Organization | undefined = undefined;
    try {
      org = await fetchOrg(api, slug);
    } catch (err) {
      if (!err) {
        throw err;
      }

      OrganizationStore.onFetchOrgError(err);

      if (err.status === 403 || err.status === 401) {
        const errMessage = getErrorMessage(err);

        if (errMessage) {
          addErrorMessage(errMessage);
          throw errMessage;
        }

        return undefined;
      }
      Sentry.captureException(err);
    }
    return org;
  };

  const loadTeamsAndProjects = async () => {
    const [[projects], [teams, , resp]] = await fetchProjectsAndTeams(slug);

    ProjectsStore.loadInitialData(projects ?? []);

    const teamPageLinks = resp?.getResponseHeader('Link');
    if (teamPageLinks) {
      const paginationObject = parseLinkHeader(teamPageLinks);
      const hasMore = paginationObject?.next?.results ?? false;
      const cursor = paginationObject.next?.cursor;
      TeamStore.loadInitialData(teams, hasMore, cursor);
    } else {
      TeamStore.loadInitialData(teams);
    }
    return [projects, teams];
  };

  await Promise.all([loadOrganization(), loadTeamsAndProjects()]);
}
