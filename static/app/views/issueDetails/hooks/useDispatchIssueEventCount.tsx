import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/context';

import {
  issueDetailsEventsApiOptions,
  useIssueDetailsEventView,
} from './issueDetailsEventsQuery';

function useIssueEventCount(group: Group): number | undefined {
  const organization = useOrganization();
  const location = useLocation();
  const eventView = useIssueDetailsEventView({group, queryProps: {fields: ['count()']}});

  const {data: eventCountResponse} = useQuery(
    issueDetailsEventsApiOptions<{data: Array<{'count()': number}>}>({
      eventView,
      group,
      location,
      organization,
      referrer: 'issue_details.streamline_graph',
    })
  );

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
