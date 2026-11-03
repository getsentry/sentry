import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useParams} from 'sentry/utils/useParams';

import {EventList} from './eventList';
import {useGroup} from './useGroup';

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
