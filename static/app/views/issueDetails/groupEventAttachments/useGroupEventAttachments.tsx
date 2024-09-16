import pick from 'lodash/pick';

import type {IssueAttachment} from 'sentry/types/group';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const MAX_SCREENSHOTS_PER_PAGE = 12;

interface UseGroupEventAttachmentsOptions {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  groupId: string;
}

interface MakeFetchGroupEventAttachmentsQueryKeyOptions
  extends UseGroupEventAttachmentsOptions {
  location: ReturnType<typeof useLocation>;
  orgSlug: string;
}

export const makeFetchGroupEventAttachmentsQueryKey = ({
  activeAttachmentsTab,
  groupId,
  orgSlug,
  location,
}: MakeFetchGroupEventAttachmentsQueryKeyOptions): ApiQueryKey => {
  return [
    `/organizations/${orgSlug}/issues/${groupId}/attachments/`,
    {
      query:
        activeAttachmentsTab === 'screenshot'
          ? {
              // TODO: We shouldn't use all query params since not all of them will apply
              ...location.query,
              types: undefined, // need to explicitly set this to undefined because AsyncComponent adds location query back into the params
              screenshot: 1,
              per_page: MAX_SCREENSHOTS_PER_PAGE,
            }
          : {
              ...pick(location.query, ['cursor', 'environment', 'types']),
              per_page: 50,
            },
    },
  ];
};

export function useGroupEventAttachments({
  groupId,
  activeAttachmentsTab,
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
      location,
    }),
    {staleTime: 60_000}
  );
  return {
    attachments,
    isPending,
    isError,
    getResponseHeader,
    refetch,
  };
}
