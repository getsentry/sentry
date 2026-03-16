import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Event} from 'sentry/types/event';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
import {
  getGroupEventQueryKey,
  useDefaultIssueEvent,
  useEnvironmentsFromUrl,
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
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const eventId = eventIdProp ?? defaultIssueEvent;

  const isReservedEventId = RESERVED_EVENT_IDS.has(eventId);
  const isSpecificEventId = eventId && !isReservedEventId;

  const {selection: pageFilters} = usePageFilters();

  const hasSetStatsPeriod =
    // If we are on a specific event, the endpoint will return it regardless of the time range
    !isSpecificEventId &&
    (location.query.statsPeriod || location.query.start || location.query.end);
  const periodQuery = hasSetStatsPeriod ? getPeriod(pageFilters.datetime) : {};

  const queryKey = getGroupEventQueryKey({
    orgSlug: organization.slug,
    groupId,
    eventId,
    environments,
    query: eventQuery,
    ...periodQuery,
  });

  const staleTime = isSpecificEventId ? Infinity : 30000;

  return useApiQuery<Event>(queryKey, {
    staleTime,
    enabled: options?.enabled && !!eventId,
    retry: false,
  });
}
