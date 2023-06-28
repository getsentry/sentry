import {useCallback, useState} from 'react';

import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useTimeout from 'sentry/utils/useTimeout';
import {
  getGroupDetailsQueryData,
  getGroupEventDetailsQueryData,
} from 'sentry/views/issueDetails/utils';

const HOVERCARD_CONTENT_DELAY = 400;

export function useDelayedLoadingState() {
  const [shouldShowLoadingState, setShouldShowLoadingState] = useState(false);

  const onTimeout = useCallback(() => {
    setShouldShowLoadingState(true);
  }, []);

  const {start, end, cancel} = useTimeout({
    timeMs: HOVERCARD_CONTENT_DELAY,
    onTimeout,
  });

  const reset = useCallback(() => {
    setShouldShowLoadingState(false);
    cancel();
  }, [cancel]);

  return {
    shouldShowLoadingState,
    onRequestBegin: start,
    onRequestEnd: end,
    reset,
  };
}

export function usePreviewEvent<T = Event>({groupId}: {groupId: string}) {
  const organization = useOrganization();
  const hasPrefetchIssueFeature = organization.features.includes(
    'issue-list-prefetch-issue-on-hover'
  );

  // This query should match the one on group details so that the event will
  // be fully loaded already if you preview then click.
  const eventQuery = useApiQuery<T>(
    [
      `/issues/${groupId}/events/latest/`,
      {query: getGroupEventDetailsQueryData({stacktraceOnly: !hasPrefetchIssueFeature})},
    ],
    {staleTime: 30000, cacheTime: 30000}
  );

  // Prefetch the group as well, but don't use the result
  useApiQuery([`/issues/${groupId}/`, {query: getGroupDetailsQueryData()}], {
    staleTime: 30000,
    cacheTime: 30000,
    enabled: defined(groupId) && hasPrefetchIssueFeature,
  });

  return eventQuery;
}
