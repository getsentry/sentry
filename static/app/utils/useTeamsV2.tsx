import uniqBy from 'lodash/uniqBy';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

interface UseTeamOptions {
  ids?: string[];
  slugs?: string[];
}

interface UseTeamsResult {
  isLoading: boolean;
  teams: Team[];
}

function buildTeamsQueryKey(
  orgSlug: string = '',
  ids: string[],
  slugs: string[]
): ApiQueryKey {
  const query: {query?: string} = {};

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (ids !== undefined && ids.length > 0) {
    query.query = ids.map(id => `id:${id}`).join(' ');
  }

  return [`/organizations/${orgSlug}/teams/`, {query}];
}

/**
 * Does not search
 */
export function useTeamsV2({ids = [], slugs = []}: UseTeamOptions = {}): UseTeamsResult {
  const {organization} = useLegacyStore(OrganizationStore);
  const storeState = useLegacyStore(TeamStore);

  const idsToFetch = ids.filter(id => !storeState.teams.find(team => team.id === id));
  const slugsToFetch = slugs.filter(
    slug => !storeState.teams.find(team => team.slug === slug)
  );

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = idsToFetch.length > 0 || slugsToFetch.length > 0;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const queryKey = buildTeamsQueryKey(organization?.slug, ids, slugs);
  const {data: additionalTeams = [], isLoading} = useApiQuery<Team[]>(queryKey, {
    staleTime: 0,
    enabled: queryEnabled,
  });

  const allTeams = uniqBy([...storeState.teams, ...additionalTeams], team => team.id);
  const shouldFilterTeams = ids.length > 0 || slugs.length > 0;
  const teams = shouldFilterTeams
    ? allTeams.filter(team => ids.includes(team.id) || slugs.includes(team.slug))
    : allTeams;

  return {
    teams,
    isLoading: queryEnabled ? isLoading : false,
  };
}
