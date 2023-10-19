import {useEffect, useMemo} from 'react';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

interface UseTeamsResult {
  isError: boolean | null;
  isLoading: boolean;
  teams: Team[];
}

function buildUserTeamsQueryKey(orgSlug: string): ApiQueryKey {
  return [`/organizations/${orgSlug}/user-teams/`];
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
  const {organization} = useLegacyStore(OrganizationStore);
  const storeState = useLegacyStore(TeamStore);

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = !storeState.loadedUserTeams;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const {
    data: additionalTeams = [],
    isLoading,
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
  const teams = useMemo<Team[]>(() => {
    return isSuperuser ? storeState.teams : storeState.teams.filter(t => t.isMember);
  }, [storeState.teams, isSuperuser]);

  return {
    teams,
    isLoading: queryEnabled ? isLoading : storeState.loading,
    isError: queryEnabled ? isError : null,
  };
}
