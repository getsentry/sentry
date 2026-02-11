import {useMemo} from 'react';

import {ItemType, type SearchGroup} from 'sentry/components/searchBar/types';
import {escapeTagValue} from 'sentry/components/searchBar/utils';
import {IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';

export default function useAssignedSearchValues(): SearchGroup[] {
  const {teams} = useLegacyStore(TeamStore);
  const {members} = useLegacyStore(MemberListStore);

  const assignedValues: SearchGroup[] = useMemo(() => {
    const userTeams = teams.filter(team => team.isMember).map(team => `#${team.slug}`);
    const usernames: string[] = members.map(getUsername);
    const nonMemberTeams = teams
      .filter(team => !team.isMember)
      .map(team => `#${team.slug}`);

    const suggestedAssignees: string[] = ['me', 'my_teams', 'none', ...userTeams];

    return [
      {
        title: t('Suggested Values'),
        type: 'header',
        icon: <IconStar size="xs" />,
        children: suggestedAssignees.map(convertToSearchItem),
      },
      {
        title: t('All Values'),
        type: 'header',
        icon: <IconUser size="xs" />,
        children: [
          ...usernames.map(convertToSearchItem),
          ...nonMemberTeams.map(convertToSearchItem),
        ],
      },
    ];
  }, [teams, members]);

  return assignedValues;
}

const convertToSearchItem = (value: string) => {
  const escapedValue = escapeTagValue(value);
  return {
    value: escapedValue,
    desc: value,
    type: ItemType.TAG_VALUE,
  };
};
