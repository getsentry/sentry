import {useEffect, useMemo} from 'react';
import groupBy from 'lodash/groupBy';

import Avatar from 'sentry/components/avatar';
import {BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import {t} from 'sentry/locale';
import type {DetailedTeam, Team} from 'sentry/types';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

interface Options {
  /**
   * Props to pass to the leading avatar component
   */
  avatarProps?: BaseAvatarProps;
  /**
   * The current selected values that will be ensured loaded. These should be
   * in the actor identifier format
   */
  currentValue?: string[];
  /**
   * Filter teams that are not part of a the provided set of project slugs
   */
  memberOfProjectSlugs?: string[];
}

/**
 * Hook to fetch and load more owner options. This is intended to be used with
 * the SelectControl and CompactSelect.
 */
export function useOwnerOptions({
  currentValue,
  avatarProps,
  memberOfProjectSlugs,
}: Options) {
  // Ensure the current value of the fields members is loaded
  const ensureUserIds = useMemo(
    () =>
      currentValue?.filter(item => item.startsWith('user:')).map(user => user.slice(7)),
    [currentValue]
  );
  useMembers({ids: ensureUserIds});

  const {
    members,
    fetching: fetchingMembers,
    onSearch: onMemberSearch,
    loadMore: loadMoreMembers,
  } = useMembers();

  // XXX(epurkhiser): It would be nice to use an object as the value, but
  // frustratingly that is difficult likely because we're recreating this
  // object on every re-render.
  const memberOptions = members?.map(member => ({
    value: `user:${member.id}`,
    label: member.name,
    leadingItems: <Avatar user={member} {...avatarProps} />,
  }));

  // Ensure the current value of the fields teams is loaded
  const ensureTeamIds = useMemo(
    () =>
      currentValue?.filter(item => item.startsWith('team:')).map(user => user.slice(5)),
    [currentValue]
  );
  useTeamsById({ids: ensureTeamIds});

  const {
    teams,
    fetching: fetchingTeams,
    onSearch: onTeamSearch,
    loadMore: loadMoreTeams,
  } = useTeams();

  const makeTeamOption = (team: Team) => ({
    value: `team:${team.id}`,
    label: `#${team.slug}`,
    leadingItems: <Avatar team={team} {...avatarProps} />,
  });

  const makeDisabledTeamOption = (team: Team) => ({
    ...makeTeamOption(team),
    disabled: true,
    tooltip: t('%s is not a member of the selected projects', `#${team.slug}`),
    tooltipOptions: {position: 'left'},
  });

  const {disabledTeams, memberTeams, otherTeams} = groupBy(
    teams as DetailedTeam[],
    team => {
      if (
        memberOfProjectSlugs &&
        !team.projects.some(({slug}) => memberOfProjectSlugs.includes(slug))
      ) {
        return 'disabledTeams';
      }
      return team.isMember ? 'memberTeams' : 'otherTeams';
    }
  );

  const myTeamOptions = memberTeams?.map(makeTeamOption) ?? [];
  const otherTeamOptions = otherTeams?.map(makeTeamOption) ?? [];
  const disabledTeamOptions = disabledTeams?.map(makeDisabledTeamOption) ?? [];

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

  const options = [
    {
      label: t('Members'),
      options: memberOptions,
    },
    {
      label: t('My Teams'),
      options: myTeamOptions,
    },
    {
      label: t('Other Teams'),
      options: otherTeamOptions,
    },
    {
      label: t('Disabled Teams'),
      options: disabledTeamOptions,
    },
  ];

  return {
    options,
    fetching: fetchingMembers || fetchingTeams,
    onMemberSearch,
    onTeamSearch,
  };
}
