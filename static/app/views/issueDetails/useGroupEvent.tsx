import {useQuery} from '@tanstack/react-query';

import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';

import {useEventQuery} from './hooks/useEventQuery';
import {
  groupEventApiOptions,
  useDefaultIssueEvent,
  useEnvironmentsFromUrl,
} from './utils';

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

  const {statsPeriod, start, end} = loadQueryParamsFromLocation(
    pageFilterParsers,
    location
  );

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
