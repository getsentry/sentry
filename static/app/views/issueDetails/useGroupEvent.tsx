import {useQuery} from '@tanstack/react-query';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/hooks/useEventQuery';
import {
  groupEventApiOptions,
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
  const location = useLocation();
  const defaultIssueEvent = useDefaultIssueEvent();
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const eventId = eventIdProp ?? defaultIssueEvent;

  const isReservedEventId = RESERVED_EVENT_IDS.has(eventId);
  const isSpecificEventId = eventId && !isReservedEventId;

  const statsPeriod = decodeScalar(location.query.statsPeriod);
  const start = decodeScalar(location.query.start);
  const end = decodeScalar(location.query.end);

  const staleTime = isSpecificEventId ? Infinity : 30_000;

  return useQuery({
    ...groupEventApiOptions({
      orgSlug: organization.slug,
      groupId,
      eventId,
      environments,
      query: eventQuery,
      statsPeriod,
      start,
      end,
    }),
    staleTime,
    enabled: options?.enabled && !!eventId,
    retry: false,
  });
}
