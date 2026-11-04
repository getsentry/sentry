import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EventList} from 'sentry/views/issueDetails/eventList';
import {useGroupId} from 'sentry/views/issueDetails/groupIdContext';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

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
