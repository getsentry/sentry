import {useEffect, useMemo} from 'react';
import {useStore} from 'zustand';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApiQuery} from 'sentry/utils/queryClient';

interface UseTeamsResult {
  isError: boolean | null;
  isLoading: boolean;
  teams: Team[];
}

function buildUserTeamsQueryKey(orgSlug: string): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/user-teams/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ];
}

/**
 * Fetches the user's teams if they aren't already in the TeamStore.
 * @returns an array of user's teams, isLoading, and isError
 *
 * example usage:
 * ```ts
 * const {teams, isLoading, isError} = useUserTeams();
 * ```
 */
export function useUserTeams(): UseTeamsResult {
  const organization = useStore(OrganizationStore, state => state.organization);
  const storeTeams = useStore(TeamStore, state => state.teams);
  const storeLoading = useStore(TeamStore, state => state.loading);
  const loadedUserTeams = useStore(TeamStore, state => state.loadedUserTeams);

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeLoading;
  // Only fetch if there are missing teams
  const hasMissing = !loadedUserTeams;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const {
    data: additionalTeams = [],
    isPending,
    isError,
  } = useApiQuery<Team[]>(buildUserTeamsQueryKey(organization?.slug ?? ''), {
    staleTime: 0,
    enabled: queryEnabled,
  });

  // Save fetched teams to the team store
  useEffect(() => {
    if (additionalTeams.length > 0) {
      TeamStore.loadUserTeams(additionalTeams);
    }
  }, [additionalTeams]);

  const isSuperuser = isActiveSuperuser();
  const isOrgOwner = organization?.access.includes('org:admin');
  const teams = useMemo<Team[]>(() => {
    return isSuperuser || isOrgOwner ? storeTeams : storeTeams.filter(t => t.isMember);
  }, [isSuperuser, isOrgOwner, storeTeams]);

  return {
    teams,
    isLoading: queryEnabled ? isPending : storeLoading,
    isError: queryEnabled ? isError : null,
  };
}
