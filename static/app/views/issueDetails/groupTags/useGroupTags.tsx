import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface GroupTag {
  key: string;
  name: string;
  topValues: Array<{
    count: number;
    firstSeen: string;
    lastSeen: string;
    name: string;
    // null for tags like user when Snuba stores them in their own column
    value: string | null;
    /**
     * Provided for tags like `user` to help query on specific tags
     * Example: user -> `'user.id:\"1\"'`
     */
    query?: string;
  }>;
  totalValues: number;
}

interface FetchIssueTagsParameters {
  environment: string[] | string | undefined;
  /**
   * Request is disabled until groupId is defined
   */
  groupId: string | undefined;
  orgSlug: string;
  limit?: number;
}

type GroupTagUseQueryOptions = Partial<
  Omit<
    UseQueryOptions<ApiResponse<GroupTag[]>, Error, GroupTag[], ApiQueryKey>,
    'queryKey' | 'queryFn' | 'select'
  >
>;

const groupTagsOptions = ({
  groupId,
  orgSlug,
  environment,
  limit,
}: FetchIssueTagsParameters) =>
  apiOptions.as<GroupTag[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/tags/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId!},
      query: {environment, limit},
      staleTime: 30000,
    }
  );

export function useGroupTags(
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug'>,
  {enabled = true, ...options}: GroupTagUseQueryOptions = {}
) {
  const organization = useOrganization();
  return useQuery({
    ...groupTagsOptions({
      orgSlug: organization.slug,
      limit: 3,
      ...parameters,
    }),
    enabled: defined(parameters.groupId) && enabled,
    ...options,
  });
}
