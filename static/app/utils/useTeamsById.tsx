import {useEffect, useMemo} from 'react';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

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

type TeamQuery = [field: string, ids: string[]];

function buildTeamsQueryKey(orgSlug: string, teamQuery: TeamQuery | null): ApiQueryKey {
  const query: {query?: string} = {};

  if (teamQuery?.[1].length) {
    query.query = `${teamQuery[0]}:${teamQuery[1].join(',')}`;
  }

  return [`/organizations/${orgSlug}/teams/`, {query}];
}

/**
 * @returns a tuple of the identifier field and the list of identifiers
 */
function getQueryFromOptions(options: UseTeamOptions): TeamQuery | null {
  if ('ids' in options) {
    if (!options.ids?.length) {
      return null;
    }
    return ['id', options.ids];
  }

  if ('slugs' in options) {
    if (!options.slugs?.length) {
      return null;
    }
    return ['slug', options.slugs];
  }

  return null;
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

  const query = useMemo<TeamQuery | null>(() => getQueryFromOptions(options), [options]);
  const missingIds = query
    ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      query[1].filter(id => !storeState.teams.find(team => team[query[0]] === id))
    : [];

  // Wait until the store has loaded to start fetching
  const shouldConsiderFetching = !!organization?.slug && !storeState.loading;
  // Only fetch if there are missing teams
  const hasMissing = missingIds.length > 0;
  const queryEnabled = shouldConsiderFetching && hasMissing;

  const queryKey = buildTeamsQueryKey(organization?.slug ?? '', query);
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
    return query
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        storeState.teams.filter(team => query[1].includes(team[query[0]]))
      : storeState.teams;
  }, [storeState.teams, query]);

  return {
    teams,
    isLoading: queryEnabled ? isPending : storeState.loading,
    isError: queryEnabled ? isError : null,
  };
}
