import {useMemo} from 'react';

import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {getUsername} from 'sentry/utils/membersAndTeams/userUtils';

export default function useMemberUsernames() {
  const {members} = useLegacyStore(MemberListStore);
  return useMemo(() => members.map(getUsername), [members]);
}
