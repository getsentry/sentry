import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {
  getGroupEventQueryKey,
  useDefaultIssueEvent,
} from 'sentry/views/issueDetails/utils';

interface UseGroupEventProps {
  group: Group;
  eventId?: string;
}

export function useStreamlineGroupEvent({
  group,
  eventId: eventIdProp,
}: UseGroupEventProps) {
  const organization = useOrganization();
  const query = useEventQuery({group});
  const eventView = useIssueDetailsEventView({group});
  const defaultIssueEvent = useDefaultIssueEvent();

  const eventId = eventIdProp ?? defaultIssueEvent;
  const isSpecificEvent = new Set<string | undefined>([
    'recommended',
    'latest',
    'oldest',
  ]).has(eventId);

  const queryKey = getGroupEventQueryKey({
    orgSlug: organization.slug,
    groupId: group.id,
    eventId,
    query,
    environments: [...eventView.environment],
    start: eventView.start,
    end: eventView.end,
  });

  const eventQuery = useApiQuery<Event>(queryKey, {
    // Specific events will never change.
    staleTime: isSpecificEvent ? Infinity : 30000,
    retry: false,
  });

  return eventQuery;
}
