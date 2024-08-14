import groupBy from 'lodash/groupBy';

import Avatar from 'sentry/components/avatar';
import type {BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import {t} from 'sentry/locale';
import type {DetailedTeam, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';

interface Options {
  /**
   * Props to pass to the leading avatar component
   */
  avatarProps?: BaseAvatarProps;
  /**
   * Filter teams that are not part of a the provided set of project slugs
   */
  memberOfProjectSlugs?: string[];
  /**
   * The users in the owner list
   */
  members?: User[];
  /**
   * The teams in the owners list
   */
  teams?: Team[];
}

/**
 * Hook to transform a list of users and teams into a options list, intdended
 * to be used with SelectControl or CompactSelect.
 */
export function useOwnerOptions({
  teams,
  members,
  avatarProps,
  memberOfProjectSlugs,
}: Options) {
  // XXX(epurkhiser): It would be nice to use an object as the value, but
  // frustratingly that is difficult likely because we're recreating this
  // object on every re-render.
  const memberOptions =
    members?.map(member => ({
      value: `user:${member.id}`,
      label: member.name,
      leadingItems: <Avatar user={member} {...avatarProps} />,
    })) ?? [];

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

  const options = [
    {
      label: t('My Teams'),
      options: myTeamOptions,
    },
    {
      label: t('Members'),
      options: memberOptions,
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

  return options;
}
