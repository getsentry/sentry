import {useMemo} from 'react';

import {useOrganizationMemberUsers} from 'sentry/utils/members/useOrganizationMemberUsers';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';

export function useMemberUsernames() {
  const {data: members = []} = useOrganizationMemberUsers();
  return useMemo(() => members.map(getUsername), [members]);
}
