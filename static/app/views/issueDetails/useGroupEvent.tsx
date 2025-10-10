import type {Event} from 'sentry/types/event';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
import {
  getGroupEventQueryKey,
  useDefaultIssueEvent,
  useEnvironmentsFromUrl,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';

export const RESERVED_EVENT_IDS = new Set(['recommended', 'latest', 'oldest']);
interface UseGroupEventOptions {
  eventId: string | undefined;
  groupId: string;
  options?: {enabled?: boolean};
}

export function useGroupEvent({
  groupId,
  eventId: eventIdProp,
  options,
}: UseGroupEventOptions) {
  const organization = useOrganization();
  const location = useLocation<{
    end?: string;
    query?: string;
    start?: string;
    statsPeriod?: string;
  }>();
  const defaultIssueEvent = useDefaultIssueEvent();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const eventId = eventIdProp ?? defaultIssueEvent;

  const isReservedEventId = RESERVED_EVENT_IDS.has(eventId);
  const isLatestOrRecommendedEvent = eventId === 'latest' || eventId === 'recommended';

  const query =
    isLatestOrRecommendedEvent && typeof location.query.query === 'string'
      ? location.query.query
      : undefined;

  const {selection: pageFilters} = usePageFilters();

  // Only use stats period if it is set in the URL
  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;
  const periodQuery =
    hasStreamlinedUI && hasSetStatsPeriod ? getPeriod(pageFilters.datetime) : {};

  const queryKey = getGroupEventQueryKey({
    orgSlug: organization.slug,
    groupId,
    eventId,
    environments,
    query: hasStreamlinedUI ? eventQuery : query,
    ...periodQuery,
  });

  // Legacy: Latest/recommended event will change over time, so only cache for 30 seconds
  // Oldest/specific events will never change
  const staleTime = isLatestOrRecommendedEvent ? 30000 : Infinity;
  // Streamlined: Only specific events will never change, so cache indefinitely
  const streamlineStaleTime = isReservedEventId ? Infinity : 30000;

  return useApiQuery<Event>(queryKey, {
    staleTime: hasStreamlinedUI ? streamlineStaleTime : staleTime,
    enabled: options?.enabled && !!eventId,
    retry: false,
  });
}
