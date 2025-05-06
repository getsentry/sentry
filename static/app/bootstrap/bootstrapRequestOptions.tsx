import {type ApiResult, Client} from 'sentry/api';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {queryOptions, skipToken} from 'sentry/utils/queryClient';

// 30 second stale time
// Stale time decides if the query should be refetched
const BOOTSTRAP_QUERY_STALE_TIME = 30 * 1000;

// 10 minute gc time
// Warning: We will always have an observer on the organization object
// so it will never be garbage collected from the query cache
const BOOTSTRAP_QUERY_GC_TIME = 10 * 60 * 1000;

export function getBootstrapOrganizationQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-organization', orgSlug],
    queryFn: orgSlug
      ? async (): Promise<Organization> => {
          // Get the preloaded data promise
          try {
            const preloadResponse = await getPreloadedData('organization', orgSlug);
            // If the preload request was for a different org or the promise was rejected
            if (Array.isArray(preloadResponse) && preloadResponse[0] !== null) {
              return preloadResponse[0];
            }
          } catch {
            // Silently try again with non-preloaded data
          }

          const uncancelableApi = new Client();
          const [org] = await uncancelableApi.requestPromise(
            `/organizations/${orgSlug}/`,
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
          // Get the preloaded data promise
          try {
            const preloadResponse = await getPreloadedData('teams', orgSlug);
            // If the preload request was successful, find the matching team
            if (preloadResponse !== null && preloadResponse[0] !== null) {
              return createTeamsObject(preloadResponse);
            }
          } catch {
            // Silently try again with non-preloaded data
          }

          const uncancelableApi = new Client();
          const teamsApiResponse = await uncancelableApi.requestPromise(
            `/organizations/${orgSlug}/teams/`,
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
          // Get the preloaded data promise
          try {
            const preloadResponse = await getPreloadedData('projects', orgSlug);
            // If the preload request was successful
            if (preloadResponse !== null && preloadResponse[0] !== null) {
              return preloadResponse[0];
            }
          } catch {
            // Silently try again with non-preloaded data
          }

          const uncancelableApi = new Client();
          const [projects] = await uncancelableApi.requestPromise(
            `/organizations/${orgSlug}/projects/`,
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
 * Small helper to access the preload requests in window.__sentry_preload
 * See preload-data.html for more details, this request is started before the app is loaded
 * saving time on the initial page load.
 */
function getPreloadedData(
  name: 'organization' | 'projects' | 'teams',
  slug: string
): Promise<ApiResult | null> {
  const data = window.__sentry_preload;
  if (!data?.[name] || data.orgSlug?.toLowerCase() !== slug.toLowerCase()) {
    throw new Error('Prefetch query not found or slug mismatch');
  }

  const promise = data[name];
  // Prevent reusing the promise later
  delete data[name];
  return promise;
}
