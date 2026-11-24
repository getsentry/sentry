import {useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useStore} from 'zustand';
import {useShallow} from 'zustand/react/shallow';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';

import {apiOptions} from './api/apiOptions';
import {isActiveSuperuser} from './isActiveSuperuser';

interface UseTeamsResult {
  isError: boolean | null;
  isLoading: boolean;
  teams: Team[];
}

function buildUserTeamsApiOptions(orgSlug: string) {
  return apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/user-teams/', {
    path: {organizationIdOrSlug: orgSlug},
    staleTime: 0,
  });
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
  const storeState = useStore(
    TeamStore,
    useShallow(state => ({
      loadedUserTeams: state.loadedUserTeams,
      loading: state.loading,
      teams: state.teams,
    }))
  );

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = !storeState.loadedUserTeams;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const {
    data: additionalTeams = [],
    isPending,
    isError,
  } = useQuery({
    ...buildUserTeamsApiOptions(organization?.slug ?? ''),

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
    return isSuperuser || isOrgOwner
      ? storeState.teams
      : storeState.teams.filter(t => t.isMember);
  }, [isSuperuser, isOrgOwner, storeState.teams]);

  return {
    teams,
    isLoading: queryEnabled ? isPending : storeState.loading,
    isError: queryEnabled ? isError : null,
  };
}
