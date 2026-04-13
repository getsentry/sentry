import {useQuery} from '@tanstack/react-query';

import type {DateString} from 'sentry/types/core';
import type {Group, IssueAttachment} from 'sentry/types/group';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {keepPreviousData} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';

interface UseGroupEventAttachmentsOptions {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  group: Group;
  options?: {
    /**
     * If true, the query will fetch all available attachments for the group, ignoring the
     * current filters (for environment, date, query, etc).
     */
    fetchAllAvailable?: boolean;
    placeholderData?: typeof keepPreviousData;
  };
}

type GroupEventAttachmentsTypeFilter =
  | 'event.minidump'
  | 'event.applecrashreport'
  | 'event.screenshot';

interface GroupEventAttachmentsQuery {
  cursor?: string;
  end?: DateString;
  environment?: string[] | string;
  per_page?: string;
  query?: string;
  screenshot?: '1';
  start?: DateString;
  statsPeriod?: string;
  types?: GroupEventAttachmentsTypeFilter | GroupEventAttachmentsTypeFilter[];
}

export interface FetchGroupEventAttachmentsApiOptionsParams {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  group: Group;
  orgSlug: string;
  cursor?: string;
  end?: DateString;
  environment?: string[] | string;
  eventQuery?: string;
  start?: DateString;
  statsPeriod?: string;
}

export function fetchGroupEventAttachmentsApiOptions({
  activeAttachmentsTab,
  group,
  orgSlug,
  cursor,
  environment,
  eventQuery,
  start,
  end,
  statsPeriod,
}: FetchGroupEventAttachmentsApiOptionsParams) {
  const query: GroupEventAttachmentsQuery = {};

  if (environment) {
    query.environment = environment;
  }

  if (eventQuery) {
    query.query = eventQuery;
  }

  if (start) {
    query.start = start;
  }

  if (end) {
    query.end = end;
  }

  if (statsPeriod) {
    query.statsPeriod = statsPeriod;
  }

  if (cursor) {
    query.cursor = cursor;
  }

  if (activeAttachmentsTab === 'screenshot') {
    query.screenshot = '1';
  } else if (activeAttachmentsTab === 'onlyCrash') {
    query.types = ['event.minidump', 'event.applecrashreport'];
  }

  return apiOptions.as<IssueAttachment[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/attachments/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: group.id},
      query,
      staleTime: 60_000,
    }
  );
}

export function useGroupEventAttachments({
  group,
  activeAttachmentsTab,
  options,
}: UseGroupEventAttachmentsOptions) {
  const location = useLocation();
  const organization = useOrganization();
  const eventQuery = useEventQuery();
  const eventView = useIssueDetailsEventView({group});

  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;
  const fetchAllAvailable = options?.fetchAllAvailable;

  const {data, isPending, isError, refetch} = useQuery({
    ...fetchGroupEventAttachmentsApiOptions({
      activeAttachmentsTab,
      group,
      orgSlug: organization.slug,
      cursor: location.query.cursor as string | undefined,
      // We only want to filter by date/query/environment if we're using the Streamlined UI
      environment: fetchAllAvailable ? undefined : (eventView.environment as string[]),
      start: fetchAllAvailable && !hasSetStatsPeriod ? undefined : eventView.start,
      end: fetchAllAvailable && !hasSetStatsPeriod ? undefined : eventView.end,
      statsPeriod:
        fetchAllAvailable && !hasSetStatsPeriod ? undefined : eventView.statsPeriod,
      eventQuery: fetchAllAvailable ? undefined : eventQuery,
    }),
    placeholderData: options?.placeholderData,
    select: selectJsonWithHeaders,
  });

  return {
    attachments: data?.json ?? [],
    isPending,
    isError,
    pageLinks: data?.headers.Link ?? null,
    refetch,
  };
}
