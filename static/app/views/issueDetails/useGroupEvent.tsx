import type {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getGroupEventQueryKey,
  useDefaultIssueEvent,
} from 'sentry/views/issueDetails/utils';

interface UseGroupEventOptions {
  environments: string[];
  eventId: string | undefined;
  groupId: string;
}

export function useGroupEvent({groupId, eventId, environments}: UseGroupEventOptions) {
  const organization = useOrganization();
  const location = useLocation<{query?: string}>();
  const defaultIssueEvent = useDefaultIssueEvent();
  const eventIdUrl = eventId ?? defaultIssueEvent;
  const recommendedEventQuery =
    typeof location.query.query === 'string' ? location.query.query : undefined;

  const isLatestOrRecommendedEvent =
    eventIdUrl === 'latest' || eventIdUrl === 'recommended';

  const queryKey = getGroupEventQueryKey({
    orgSlug: organization.slug,
    groupId,
    eventId: eventIdUrl,
    environments,
    recommendedEventQuery: isLatestOrRecommendedEvent ? recommendedEventQuery : undefined,
  });

  const eventQuery = useApiQuery<Event>(queryKey, {
    // Latest/recommended event will change over time, so only cache for 30 seconds
    // Oldest/specific events will never change
    staleTime: isLatestOrRecommendedEvent ? 30000 : Infinity,
    retry: false,
  });

  return eventQuery;
}
