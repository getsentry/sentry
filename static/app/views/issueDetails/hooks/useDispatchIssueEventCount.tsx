import {useEffect} from 'react';

import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {useIssueDetails} from 'sentry/views/issueDetails/context';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/hooks/useIssueDetailsDiscoverQuery';

type EventCountResponse = {
  data: Array<{'count()': number}>;
};

function useIssueEventCount(group: Group): number | undefined {
  const eventView = useIssueDetailsEventView({group, queryProps: {fields: ['count()']}});

  const {data: eventCountResponse} = useIssueDetailsDiscoverQuery<EventCountResponse>({
    params: {
      route: 'events',
      eventView,
      referrer: 'issue_details.streamline_graph',
    },
  });

  return eventCountResponse?.data[0]?.['count()'];
}

export function useDispatchIssueEventCount(group: Group) {
  const {dispatch} = useIssueDetails();

  const eventCount = useIssueEventCount(group);

  useEffect(() => {
    if (defined(eventCount)) {
      dispatch({type: 'UPDATE_EVENT_COUNT', count: eventCount});
    }
  }, [eventCount, dispatch]);
}
