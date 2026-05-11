import {useCallback, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import {getEventSearchFromIssueQuery} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {
  groupEventApiOptions,
  useDefaultIssueEvent,
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

export function usePreviewEvent<T = Event>({
  groupId,
  query,
}: {
  groupId: string;
  query?: string;
}) {
  const organization = useOrganization();
  const defaultIssueEvent = useDefaultIssueEvent();
  const sanitizedQuery = getEventSearchFromIssueQuery(query ?? '');

  // This query should match the one on group details so that the event will
  // be fully loaded already if you preview then click.
  const eventQuery = useQuery({
    ...groupEventApiOptions<T>({
      orgSlug: organization.slug,
      groupId,
      eventId: defaultIssueEvent,
      query: sanitizedQuery,
      // TODO: omitting environments also means we'll not preload the correct event
      environments: [],
    }),
    gcTime: 30_000,
  });

  // Prefetch the group as well, but don't use the result
  useGroup({groupId, options: {enabled: defined(groupId)}});

  return eventQuery;
}
