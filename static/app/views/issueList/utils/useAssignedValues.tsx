import {useMemo} from 'react';

import {
  ItemType,
  type SearchGroup,
} from 'sentry/components/deprecatedSmartSearchBar/types';
import {escapeTagValue} from 'sentry/components/deprecatedSmartSearchBar/utils';
import {IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {User} from 'sentry/types/user';

export default function useAssignedValues(): SearchGroup[] {
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

export const getUsername = ({isManaged, username, email}: User) => {
  const uuidPattern = /[0-9a-f]{32}$/;
  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  }
  return !isManaged && username ? username : email;
};

const convertToSearchItem = (value: string) => {
  const escapedValue = escapeTagValue(value);
  return {
    value: escapedValue,
    desc: value,
    type: ItemType.TAG_VALUE,
  };
};
