import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {
  useIssueDetailsDiscoverQuery,
  useIssueDetailsEventView,
} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';

export function useIssueDetailsEventCount({group}: {group: Group}) {
  const eventView = useIssueDetailsEventView({group});
  const {data: groupStats} = useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
    params: {
      route: 'events-stats',
      eventView,
      referrer: 'issue_details.streamline_graph',
    },
  });
  const eventCount = useMemo(() => {
    if (!groupStats?.['count()']) {
      return 0;
    }
    return groupStats['count()']?.data?.reduce((count, [_timestamp, countData]) => {
      return count + (countData?.[0]?.count ?? 0);
    }, 0);
  }, [groupStats]);
  return eventCount;
}
