import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';

import {EventList} from './eventList';
import {useGroupId} from './groupIdContext';
import {useGroup} from './useGroup';

function IssueEventsList() {
  const groupId = useGroupId();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return <EventList group={group} />;
}

export default IssueEventsList;
