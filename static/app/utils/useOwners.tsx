import {useEffect, useMemo} from 'react';
import uniqBy from 'lodash/uniqBy';

import {useMembers} from 'sentry/utils/members/useMembers';
import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

interface Options {
  /**
   * The current selected values that will be ensured loaded. These should be
   * in the actor identifier format
   */
  currentValue?: string[];
}

/**
 * Hook to fetch owner options
 */
export function useOwners({currentValue}: Options) {
  // Ensure the current value of the fields members is loaded
  const ensureUserIds = useMemo(
    () =>
      currentValue
        ?.filter(item => item.startsWith('user:'))
        .map(user => user.replace(/^user:/, '')),
    [currentValue]
  );
  const hasEnsureUserIds = (ensureUserIds?.length ?? 0) > 0;
  const {data: ensuredMembers = [], isPending: isEnsuringMembers} = useMembers({
    enabled: hasEnsureUserIds,
    ids: ensureUserIds ?? [],
  });

  const {
    members: defaultMembers,
    isPending: isLoadingMembers,
    onSearch: onMemberSearch,
  } = useOrganizationMemberSearch();
  const members = useMemo(
    () => uniqBy([...ensuredMembers, ...defaultMembers], member => member.id),
    [defaultMembers, ensuredMembers]
  );

  // Ensure the current value of the fields teams is loaded
  const ensureTeamIds = useMemo(
    () =>
      currentValue
        ?.filter(item => item.startsWith('team:'))
        .map(user => user.replace(/^team:/, '')),
    [currentValue]
  );
  useTeamsById({ids: ensureTeamIds});

  const {
    teams,
    fetching: fetchingTeams,
    onSearch: onTeamSearch,
    loadMore: loadMoreTeams,
  } = useTeams();

  // TODO(epurkhiser): This is an unfortunate hack right now since we don't
  // actually load teams anywhere and the useTeams hook doesn't handle initial
  // loading of data.
  //
  // In the future when this uses react query we should be able to clean this up.
  useEffect(
    () => {
      loadMoreTeams();
    },
    // Only ensure things are loaded at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    members,
    teams,
    fetching:
      (hasEnsureUserIds && isEnsuringMembers) || isLoadingMembers || fetchingTeams,
    onMemberSearch,
    onTeamSearch,
  };
}
