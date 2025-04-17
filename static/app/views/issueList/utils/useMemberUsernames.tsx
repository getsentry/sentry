import {useMemo} from 'react';

import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {getUsername} from 'sentry/views/issueList/utils/useAssignedValues';

export default function useMemberUsernames() {
  const {members} = useLegacyStore(MemberListStore);
  return useMemo(() => members.map(getUsername), [members]);
}
