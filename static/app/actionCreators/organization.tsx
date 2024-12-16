// XXX(epurkhiser): Ensure the LatestContextStore is initialized before we set
// the active org. Otherwise we will trigger an action that does nothing
import 'sentry/stores/latestContextStore';

import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {setActiveOrganization} from 'sentry/actionCreators/organizations';
import type {ResponseMeta} from 'sentry/api';
import {Client} from 'sentry/api';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import {
  addOrganizationFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import {getPreloadedDataPromise} from 'sentry/utils/getPreloadedData';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';

async function fetchOrg(
  api: Client,
  slug: string,
  usePreload?: boolean
): Promise<Organization> {
  const [org] = await getPreloadedDataPromise(
    'organization',
    slug,
    () =>
      // This data should get preloaded in static/sentry/index.ejs
      // If this url changes make sure to update the preload
      api.requestPromise(`/organizations/${slug}/`, {
        includeAllArgs: true,
        query: {detailed: 0, include_feature_flags: 1},
      }),
    usePreload
  );

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
  slug: string,
  usePreload?: boolean
): Promise<
  [
    [Project[], string | undefined, XMLHttpRequest | ResponseMeta | undefined],
    [Team[], string | undefined, XMLHttpRequest | ResponseMeta | undefined],
  ]
> {
  // Create a new client so the request is not cancelled
  const uncancelableApi = new Client();

  const projectsPromise = getPreloadedDataPromise(
    'projects',
    slug,
    () =>
      // This data should get preloaded in static/sentry/index.ejs
      // If this url changes make sure to update the preload
      uncancelableApi.requestPromise(`/organizations/${slug}/projects/`, {
        includeAllArgs: true,
        query: {
          all_projects: 1,
          collapse: ['latestDeploys', 'unusedFeatures'],
        },
      }),
    usePreload
  );

  const teamsPromise = getPreloadedDataPromise(
    'teams',
    slug,
    // This data should get preloaded in static/sentry/index.ejs
    // If this url changes make sure to update the preload
    () =>
      uncancelableApi.requestPromise(`/organizations/${slug}/teams/`, {
        includeAllArgs: true,
      }),
    usePreload
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
 * @param usePreload Should the preloaded data be used if available?
 */
export function fetchOrganizationDetails(
  api: Client,
  slug: string,
  silent: boolean,
  usePreload?: boolean
) {
  if (!silent) {
    OrganizationStore.reset();
    ProjectsStore.reset();
    TeamStore.reset();
    PageFiltersStore.onReset();
  }

  const getErrorMessage = err => {
    if (typeof err.responseJSON?.detail === 'string') {
      return err.responseJSON?.detail;
    }
    if (typeof err.responseJSON?.detail?.message === 'string') {
      return err.responseJSON?.detail.message;
    }
    return null;
  };

  const loadOrganization = () => {
    return new Promise(async (resolve, reject) => {
      let org: Organization | undefined = undefined;
      try {
        org = await fetchOrg(api, slug, usePreload);
      } catch (err) {
        if (!err) {
          reject(err);
          return;
        }

        OrganizationStore.onFetchOrgError(err);

        if (err.status === 403 || err.status === 401) {
          const errMessage = getErrorMessage(err);

          if (errMessage) {
            addErrorMessage(errMessage);
            reject(errMessage);
          }

          return;
        }
        Sentry.captureException(err);
      }
      resolve(org);
    });
  };

  const loadTeamsAndProjects = () => {
    return new Promise(async resolve => {
      const [[projects], [teams, , resp]] = await fetchProjectsAndTeams(slug, usePreload);

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
      resolve([projects, teams]);
    });
  };

  return Promise.all([loadOrganization(), loadTeamsAndProjects()]);
}
