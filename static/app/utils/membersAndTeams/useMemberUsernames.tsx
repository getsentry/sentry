import {useMemo} from 'react';

import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';
import {useMembers} from 'sentry/utils/useMembers';

export function useMemberUsernames() {
  const {members} = useMembers();
  return useMemo(() => members.map(getUsername), [members]);
}
