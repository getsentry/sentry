import {useEffect, useMemo} from 'react';

import {useMembers} from 'sentry/utils/useMembers';
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
  useMembers({ids: ensureUserIds});

  const {
    members,
    fetching: fetchingMembers,
    onSearch: onMemberSearch,
    loadMore: loadMoreMembers,
  } = useMembers();

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
  // actually load members anywhere and the useMembers and useTeams hook don't
  // handle initial loading of data.
  //
  // In the future when these things use react query we should be able to clean
  // this up.
  useEffect(
    () => {
      loadMoreMembers();
      loadMoreTeams();
    },
    // Only ensure things are loaded at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    members,
    teams,
    fetching: fetchingMembers || fetchingTeams,
    onMemberSearch,
    onTeamSearch,
  };
}
