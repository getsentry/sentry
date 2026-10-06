import {useLayoutEffect} from 'react';
import * as Sentry from '@sentry/react';
import {queryOptions, skipToken, useQuery} from '@tanstack/react-query';

import {setActiveOrganization} from 'sentry/actionCreators/organizations';
import {Client} from 'sentry/api';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {ApiResult} from 'sentry/types/api';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {PreloadRequestName} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {FeatureFlagOverrides} from 'sentry/utils/featureFlagOverrides';
import {
  addOrganizationFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';

// 30 second stale time
// Stale time decides if the query should be refetched
const BOOTSTRAP_QUERY_STALE_TIME = 30 * 1000;

// 10 minute gc time
// Warning: We will always have an observer on the organization object
// so it will never be garbage collected from the query cache
const BOOTSTRAP_QUERY_GC_TIME = 10 * 60 * 1000;

export function useBootstrapOrganizationQuery(orgSlug: string | null) {
  const organizationQuery = useQuery(getBootstrapOrganizationQueryOptions(orgSlug));

  useLayoutEffect(() => {
    if (organizationQuery.data) {
      // Shallow copy to avoid mutating the original object
      const organization = {...organizationQuery.data};

      // FeatureFlagOverrides mutates the organization object
      FeatureFlagOverrides.singleton().loadOrg(organization);
      addOrganizationFeaturesHandler({
        organization,
        handler: buildSentryFeaturesHandler('feature.organizations:'),
      });

      OrganizationStore.onUpdate(organization, {replace: true});
      setActiveOrganization(organization);

      const scope = Sentry.getCurrentScope();
      scope.setTag('organization', organization.id);
      scope.setTag('organization.slug', organization.slug);
      scope.setAttributes({
        organization: organization.id,
        'organization.slug': organization.slug,
      });
      scope.setContext('organization', {
        id: organization.id,
        slug: organization.slug,
      });
    }
    if (organizationQuery.error) {
      OrganizationStore.onFetchOrgError(organizationQuery.error as any);
    }
  }, [organizationQuery.data, organizationQuery.error]);

  return organizationQuery;
}

export function useBootstrapTeamsQuery(orgSlug: string | null) {
  const teamsQuery = useQuery(getBoostrapTeamsQueryOptions(orgSlug));

  useLayoutEffect(() => {
    if (teamsQuery.data) {
      TeamStore.loadInitialData(
        teamsQuery.data.teams,
        teamsQuery.data.hasMore,
        teamsQuery.data.cursor
      );
    }
  }, [teamsQuery.data]);

  return teamsQuery;
}

export function useBootstrapProjectsQuery(orgSlug: string | null) {
  const projectsQuery = useQuery(getBootstrapProjectsQueryOptions(orgSlug));

  useLayoutEffect(() => {
    if (projectsQuery.data) {
      ProjectsStore.loadInitialData(projectsQuery.data);
    }
  }, [projectsQuery.data]);

  return projectsQuery;
}

export function getBootstrapOrganizationQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-organization', orgSlug],
    queryFn: orgSlug
      ? async (): Promise<Organization> => {
          const preloadResponse = await consumePreloadedData('organization', orgSlug);
          if (preloadResponse) {
            return preloadResponse[0];
          }

          const uncancelableApi = new Client();
          const [org] = await uncancelableApi.requestPromise(
            getApiUrl('/organizations/$organizationIdOrSlug/', {
              path: {organizationIdOrSlug: orgSlug},
            }),
            {
              includeAllArgs: true,
              query: {detailed: 0, include_feature_flags: 1},
            }
          );
          return org;
        }
      : skipToken,
    staleTime: BOOTSTRAP_QUERY_STALE_TIME,
    gcTime: BOOTSTRAP_QUERY_GC_TIME,
    retry: false,
  });
}

/**
 * The TeamsStore expects a cursor, hasMore, and teams
 * Since some of this information exists in headers, parse it into something we can serialize
 */
function createTeamsObject(response: ApiResult): {
  cursor: string | null;
  hasMore: boolean;
  teams: Team[];
} {
  const teams = response[0];
  const paginationObject = parseLinkHeader(response[2]!.getResponseHeader('Link'));
  const hasMore = paginationObject?.next?.results ?? false;
  const cursor = paginationObject.next?.cursor ?? null;
  return {teams, hasMore, cursor};
}

export function getBoostrapTeamsQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-teams', orgSlug],
    queryFn: orgSlug
      ? async (): Promise<{
          cursor: string | null;
          hasMore: boolean;
          teams: Team[];
        }> => {
          const preloadResponse = await consumePreloadedData('teams', orgSlug);
          if (preloadResponse) {
            return createTeamsObject(preloadResponse);
          }

          const uncancelableApi = new Client();
          const teamsApiResponse = await uncancelableApi.requestPromise(
            getApiUrl('/organizations/$organizationIdOrSlug/teams/', {
              path: {organizationIdOrSlug: orgSlug},
            }),
            {
              includeAllArgs: true,
            }
          );
          return createTeamsObject(teamsApiResponse);
        }
      : skipToken,
    staleTime: BOOTSTRAP_QUERY_STALE_TIME,
    gcTime: BOOTSTRAP_QUERY_GC_TIME,
    retry: false,
  });
}

export function getBootstrapProjectsQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-projects', orgSlug],
    queryFn: orgSlug
      ? async (): Promise<Project[]> => {
          const preloadResponse = await consumePreloadedData('projects', orgSlug);
          if (preloadResponse) {
            return preloadResponse[0];
          }

          const uncancelableApi = new Client();
          const [projects] = await uncancelableApi.requestPromise(
            getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
              path: {organizationIdOrSlug: orgSlug},
            }),
            {
              includeAllArgs: true,
              query: {
                all_projects: 1,
                collapse: ['latestDeploys', 'unusedFeatures'],
              },
            }
          );
          return projects;
        }
      : skipToken,
    staleTime: BOOTSTRAP_QUERY_STALE_TIME,
    gcTime: BOOTSTRAP_QUERY_GC_TIME,
    retry: false,
  });
}

/**
 * Small helper to consume the preload requests in window.__sentry_preload
 * See preload-data.html for more details, this request is started before the app is loaded
 * saving time on the initial page load.
 *
 * Resolves to null when there is no usable preloaded response, in which case
 * the caller fetches the data through the API client instead.
 */
async function consumePreloadedData(
  name: PreloadRequestName,
  slug: string
): Promise<ApiResult | null> {
  const data = window.__sentry_preload;
  const promise = data?.[name];
  if (!promise || data.orgSlug?.toLowerCase() !== slug.toLowerCase()) {
    recordPreloadUsage(name, 'missing');
    return null;
  }

  // Prevent reusing the promise later
  delete data[name];

  try {
    const response = await promise;
    if (response[0] !== null) {
      recordPreloadUsage(name, 'used');
      return response;
    }
  } catch {
    // The preload request failed, its outcome is reported separately
  }

  recordPreloadUsage(name, 'failed');
  return null;
}

/**
 * Records whether a bootstrap request was served by the preload request or had
 * to fall back to the API client.
 */
function recordPreloadUsage(
  request: PreloadRequestName,
  preload: 'used' | 'missing' | 'failed'
) {
  Sentry.metrics.count('ui.bootstrap-request', 1, {attributes: {request, preload}});
}
