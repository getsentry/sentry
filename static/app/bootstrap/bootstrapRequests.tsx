// XXX(epurkhiser): Ensure the LatestContextStore is initialized before we set
// the active org. Otherwise we will trigger an action that does nothing
import 'sentry/stores/latestContextStore';

import {useEffect} from 'react';

import {type ApiResult, Client} from 'sentry/api';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getPreloadedDataSimple} from 'sentry/utils/getPreloadedData';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {queryOptions, useQuery} from 'sentry/utils/queryClient';

// 30 second stale time
// Stale time decides if the query should be refetched
const BOOTSTRAP_QUERY_STALE_TIME = 30 * 1000;

// 10 minute gc time
// gc time is how long it will stay (even if stale) in the query cache
const BOOTSTRAP_QUERY_GC_TIME = 10 * 60 * 1000;

export function useBootstrapOrganizationQuery(orgSlug: string | null) {
  const organizationQuery = useQuery(getBootstrapOrganizationQueryOptions(orgSlug));

  useEffect(() => {
    if (organizationQuery.data) {
      OrganizationStore.onUpdate(organizationQuery.data);
    }
    if (organizationQuery.error) {
      OrganizationStore.onFetchOrgError(organizationQuery.error as any);
    }
  }, [organizationQuery.data, organizationQuery.error]);

  return organizationQuery;
}

export function useBootstrapTeamsQuery(orgSlug: string | null) {
  const teamsQuery = useQuery(getBoostrapTeamsQueryOptions(orgSlug));

  useEffect(() => {
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

  useEffect(() => {
    if (projectsQuery.data) {
      ProjectsStore.loadInitialData(projectsQuery.data);
    }
  }, [projectsQuery.data]);

  return projectsQuery;
}

export function getBootstrapOrganizationQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-organization', orgSlug],
    queryFn: async (): Promise<Organization> => {
      const uncancelableApi = new Client();
      // Get the preloaded data promise
      try {
        const preloadResponse = await getPreloadedDataSimple('organization', orgSlug!);
        // If the preload request was for a different org or the promise was rejected
        if (Array.isArray(preloadResponse) && preloadResponse[0] !== null) {
          return preloadResponse[0];
        }
      } catch {
        //
      }

      const [org] = await uncancelableApi.requestPromise(`/organizations/${orgSlug}/`, {
        includeAllArgs: true,
        query: {detailed: 0, include_feature_flags: 1},
      });
      return org;
    },
    enabled: !!orgSlug,
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
    queryFn: async (): Promise<{
      cursor: string | null;
      hasMore: boolean;
      teams: Team[];
    }> => {
      const uncancelableApi = new Client();
      // Get the preloaded data promise
      try {
        const preloadResponse = await getPreloadedDataSimple('teams', orgSlug!);
        // If the preload request was successful, find the matching team
        if (preloadResponse !== null && preloadResponse[0] !== null) {
          return createTeamsObject(preloadResponse);
        }
      } catch {
        //
      }

      const teamsApiResponse = await uncancelableApi.requestPromise(
        `/organizations/${orgSlug}/teams/`,
        {
          includeAllArgs: true,
        }
      );
      return createTeamsObject(teamsApiResponse);
    },
    enabled: !!orgSlug,
    staleTime: BOOTSTRAP_QUERY_STALE_TIME,
    gcTime: BOOTSTRAP_QUERY_GC_TIME,
    retry: false,
  });
}

export function getBootstrapProjectsQueryOptions(orgSlug: string | null) {
  return queryOptions({
    queryKey: ['bootstrap-projects', orgSlug],
    queryFn: async (): Promise<Project[]> => {
      const uncancelableApi = new Client();
      // Get the preloaded data promise
      try {
        const preloadResponse = await getPreloadedDataSimple('projects', orgSlug!);
        // If the preload request was successful
        if (preloadResponse !== null && preloadResponse[0] !== null) {
          return preloadResponse[0];
        }
      } catch {
        //
      }

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
    },
    enabled: !!orgSlug,
    staleTime: BOOTSTRAP_QUERY_STALE_TIME,
    gcTime: BOOTSTRAP_QUERY_GC_TIME,
    retry: false,
  });
}
