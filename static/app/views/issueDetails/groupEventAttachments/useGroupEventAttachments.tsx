import pick from 'lodash/pick';

import type {IssueAttachment} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const MAX_SCREENSHOTS_PER_PAGE = 12;

interface UseGroupEventAttachmentsOptions {
  activeAttachmentsTab: 'all' | 'onlyCrash' | 'screenshot';
  groupId: string;
}

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
    [
      `/organizations/${organization.slug}/issues/${groupId}/attachments/`,
      {
        query:
          activeAttachmentsTab === 'screenshot'
            ? {
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
    ],
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
