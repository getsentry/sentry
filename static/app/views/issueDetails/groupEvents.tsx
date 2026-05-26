import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useParams} from 'sentry/utils/useParams';
import {EventList} from 'sentry/views/issueDetails/streamline/eventList';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

function IssueEventsList() {
  const params = useParams<{groupId: string}>();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return <EventList group={group} />;
}

export default IssueEventsList;
