import {useMemo} from 'react';

import {useMembers} from 'sentry/utils/members/useMembers';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';

export function useMemberUsernames() {
  const {data: members = []} = useMembers();
  return useMemo(() => members.map(getUsername), [members]);
}
