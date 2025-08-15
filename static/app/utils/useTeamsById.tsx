import {useEffect, useMemo} from 'react';

import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseTeamsById {
  ids: string[] | undefined;
}

interface UseTeamsBySlug {
  slugs: string[] | undefined;
}

interface UseAllTeams {}

/**
 * ids[] and slugs[] are split to ensure that only one is provided
 */
type UseTeamOptions = UseTeamsById | UseTeamsBySlug | UseAllTeams;

interface UseTeamsResult {
  isError: boolean | null;
  isLoading: boolean;
  teams: Team[];
}

function buildTeamsQueryKey(
  orgSlug: string,
  property: 'id' | 'slug',
  values: string[]
): ApiQueryKey {
  if (property === 'id') {
    return [
      `/organizations/${orgSlug}/teams/`,
      {query: {query: values.map(id => `id:${id}`).join(' ')}},
    ];
  }

  return [
    `/organizations/${orgSlug}/teams/`,
    {query: {query: `slug:${values.join(',')}`}},
  ];
}

/**
 * example usage:
 * ```ts
 * const {teams, isLoading, isError} = useTeamsV2({slugs: ['project-slug']});
 * ```
 */
export function useTeamsById(options: UseTeamOptions = {}): UseTeamsResult {
  const organization = useOrganization({allowNull: true});
  const storeState = useLegacyStore(TeamStore);

  const teamQueryValues = useMemo<{
    property: 'id' | 'slug';
    values: Set<string> | undefined;
  } | null>(() => {
    if ('ids' in options && options.ids?.length) {
      return {property: 'id', values: new Set(options.ids)};
    }

    if ('slugs' in options && options.slugs?.length) {
      return {property: 'slug', values: new Set(options.slugs)};
    }

    return null;
  }, [options]);

  const missingValues = teamQueryValues?.values
    ? Array.from(teamQueryValues.values).filter(
        value => !storeState.teams.some(team => team[teamQueryValues.property] === value)
      )
    : [];

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = missingValues.length > 0;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const queryKey = teamQueryValues
    ? buildTeamsQueryKey(
        organization?.slug ?? '',
        teamQueryValues.property,
        missingValues ?? []
      )
    : ([`/organizations/${organization?.slug}/teams/`] as const);

  const {
    data: additionalTeams = [],
    isPending,
    isError,
  } = useApiQuery<Team[]>(queryKey, {
    staleTime: 0,
    enabled: queryEnabled,
  });

  // Save additional teams to the team store
  useEffect(() => {
    if (additionalTeams.length > 0) {
      TeamStore.loadInitialData(additionalTeams);
    }
  }, [additionalTeams]);

  const teams = useMemo<Team[]>(() => {
    return teamQueryValues
      ? storeState.teams.filter(team =>
          teamQueryValues.values?.has(team[teamQueryValues.property])
        )
      : storeState.teams;
  }, [storeState.teams, teamQueryValues]);

  return {
    teams,
    isLoading: queryEnabled ? isPending : storeState.loading,
    isError: queryEnabled ? isError : null,
  };
}
