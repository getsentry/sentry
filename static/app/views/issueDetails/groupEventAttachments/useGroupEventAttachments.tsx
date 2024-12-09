import type {DateString} from 'sentry/types/core';
import type {Group, IssueAttachment} from 'sentry/types/group';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface UseGroupEventAttachmentsOptions {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  group: Group;
  options?: {
    /**
     * If true, the query will fetch all available attachments for the group, ignoring the
     * current filters (for environment, date, query, etc).
     */
    fetchAllAvailable?: boolean;
    placeholderData?: UseApiQueryOptions<IssueAttachment[]>['placeholderData'];
  };
}

interface MakeFetchGroupEventAttachmentsQueryKeyOptions
  extends UseGroupEventAttachmentsOptions {
  cursor: string | undefined;
  environment: string[] | string | undefined;
  orgSlug: string;
  end?: DateString;
  eventQuery?: string;
  start?: DateString;
  statsPeriod?: string;
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
  types?: `${GroupEventAttachmentsTypeFilter}` | `${GroupEventAttachmentsTypeFilter}`[];
}

export const makeFetchGroupEventAttachmentsQueryKey = ({
  activeAttachmentsTab,
  group,
  orgSlug,
  cursor,
  environment,
  eventQuery,
  start,
  end,
  statsPeriod,
}: MakeFetchGroupEventAttachmentsQueryKeyOptions): ApiQueryKey => {
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

  return [`/organizations/${orgSlug}/issues/${group.id}/attachments/`, {query}];
};

export function useGroupEventAttachments({
  group,
  activeAttachmentsTab,
  options,
}: UseGroupEventAttachmentsOptions) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const location = useLocation();
  const organization = useOrganization();
  const eventQuery = useEventQuery({group});
  const eventView = useIssueDetailsEventView({group});

  const fetchAllAvailable = hasStreamlinedUI ? options?.fetchAllAvailable : true;
  const {
    data: attachments = [],
    isPending,
    isError,
    getResponseHeader,
    refetch,
  } = useApiQuery<IssueAttachment[]>(
    makeFetchGroupEventAttachmentsQueryKey({
      activeAttachmentsTab,
      group,
      orgSlug: organization.slug,
      cursor: location.query.cursor as string | undefined,
      // We only want to filter by date/query/environment if we're using the Streamlined UI
      environment: fetchAllAvailable ? undefined : (eventView.environment as string[]),
      start: fetchAllAvailable ? undefined : eventView.start,
      end: fetchAllAvailable ? undefined : eventView.end,
      statsPeriod: fetchAllAvailable ? undefined : eventView.statsPeriod,
      eventQuery: fetchAllAvailable ? undefined : eventQuery,
    }),
    {placeholderData: options?.placeholderData, staleTime: 60_000}
  );
  return {
    attachments,
    isPending,
    isError,
    getResponseHeader,
    refetch,
  };
}
