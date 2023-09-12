import {useEffect} from 'react';
import uniqBy from 'lodash/uniqBy';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

interface UseTeamsById {
  ids: string[];
}

interface UseTeamsBySlug {
  slugs: string[];
}

interface UseAllTeams {}

type UseTeamOptions = UseTeamsById | UseTeamsBySlug | UseAllTeams;

interface UseTeamsResult {
  isError: boolean | null;
  isLoading: boolean;
  teams: Team[];
}

function buildTeamsQueryKey(
  orgSlug: string,
  ids: string[],
  slugs: string[]
): ApiQueryKey {
  const query: {query?: string} = {};

  if (slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  } else if (ids.length > 0) {
    query.query = ids.map(id => `id:${id}`).join(' ');
  }

  return [`/organizations/${orgSlug}/teams/`, {query}];
}

/**
 * example usage:
 * ```ts
 * const {teams, isLoading, isError} = useTeamsV2({slugs: ['project-slug']});
 * ```
 */
export function useTeamsById(options: UseTeamOptions = {}): UseTeamsResult {
  const {organization} = useLegacyStore(OrganizationStore);
  const storeState = useLegacyStore(TeamStore);

  const ids = 'ids' in options ? options.ids : [];
  const slugs = 'slugs' in options ? options.slugs : [];
  const idsToFetch = ids.filter(id => !storeState.teams.find(team => team.id === id));
  const slugsToFetch = slugs.filter(
    slug => !storeState.teams.find(team => team.slug === slug)
  );

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = idsToFetch.length > 0 || slugsToFetch.length > 0;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const queryKey = buildTeamsQueryKey(organization?.slug ?? '', ids, slugs);
  const {
    data: additionalTeams = [],
    isLoading,
    isError,
  } = useApiQuery<Team[]>(queryKey, {
    staleTime: 0,
    enabled: queryEnabled,
  });

  // Save additional teams to the team store
  useEffect(() => {
    if (additionalTeams.length > 0) {
      // Not using the storeState to avoid depency updating this multiple times
      const newTeams = [...additionalTeams, ...TeamStore.getState().teams];
      const fetchedTeams = uniqBy(newTeams, team => team.id);
      TeamStore.loadInitialData(fetchedTeams);
    }
  }, [additionalTeams]);

  const allTeams = uniqBy([...storeState.teams, ...additionalTeams], team => team.id);
  const shouldFilterTeams = ids.length > 0 || slugs.length > 0;
  const teams = shouldFilterTeams
    ? allTeams.filter(team => ids.includes(team.id) || slugs.includes(team.slug))
    : allTeams;

  return {
    teams,
    isLoading: queryEnabled ? isLoading : storeState.loading,
    isError: queryEnabled ? isError : null,
  };
}
