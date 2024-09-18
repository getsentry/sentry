import type {IssueAttachment} from 'sentry/types/group';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface UseGroupEventAttachmentsOptions {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  groupId: string;
  options?: Pick<UseApiQueryOptions<IssueAttachment[]>, 'placeholderData'>;
}

interface MakeFetchGroupEventAttachmentsQueryKeyOptions
  extends UseGroupEventAttachmentsOptions {
  cursor: string | undefined;
  environment: string[] | string | undefined;
  orgSlug: string;
}

type GroupEventAttachmentsTypeFilter =
  | 'event.minidump'
  | 'event.applecrashreport'
  | 'event.screenshot';

interface GroupEventAttachmentsQuery {
  cursor?: string;
  environment?: string[] | string;
  per_page?: string;
  screenshot?: '1';
  types?: `${GroupEventAttachmentsTypeFilter}` | `${GroupEventAttachmentsTypeFilter}`[];
}

export const makeFetchGroupEventAttachmentsQueryKey = ({
  activeAttachmentsTab,
  groupId,
  orgSlug,
  cursor,
  environment,
}: MakeFetchGroupEventAttachmentsQueryKeyOptions): ApiQueryKey => {
  const query: GroupEventAttachmentsQuery = {};
  if (environment) {
    query.environment = environment;
  }

  if (cursor) {
    query.cursor = cursor;
  }

  if (activeAttachmentsTab === 'screenshot') {
    query.screenshot = '1';
  } else if (activeAttachmentsTab === 'onlyCrash') {
    query.types = ['event.minidump', 'event.applecrashreport'];
  }

  return [`/organizations/${orgSlug}/issues/${groupId}/attachments/`, {query}];
};

export function useGroupEventAttachments({
  groupId,
  activeAttachmentsTab,
  options,
}: UseGroupEventAttachmentsOptions) {
  const organization = useOrganization();
  const location = useLocation();
  const {
    data: attachments = [],
    isPending,
    isError,
    getResponseHeader,
    refetch,
  } = useApiQuery<IssueAttachment[]>(
    makeFetchGroupEventAttachmentsQueryKey({
      activeAttachmentsTab,
      groupId,
      orgSlug: organization.slug,
      cursor: location.query.cursor as string | undefined,
      environment: location.query.environment as string[] | string | undefined,
    }),
    {...options, staleTime: 60_000}
  );
  return {
    attachments,
    isPending,
    isError,
    getResponseHeader,
    refetch,
  };
}
