import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface GroupTag {
  key: string;
  name: string;
  topValues: Array<{
    count: number;
    firstSeen: string;
    lastSeen: string;
    name: string;
    value: string;
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

type GroupTagUseQueryOptions = Partial<UseApiQueryOptions<GroupTag[]>>;

const makeGroupTagsQueryKey = ({
  groupId,
  orgSlug,
  environment,
  limit,
}: FetchIssueTagsParameters): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/tags/', {
    path: {organizationIdOrSlug: orgSlug, issueId: groupId!},
  }),
  {query: {environment, limit}},
];

export function useGroupTags(
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug'>,
  {enabled = true, ...options}: GroupTagUseQueryOptions = {}
) {
  const organization = useOrganization();
  return useApiQuery<GroupTag[]>(
    makeGroupTagsQueryKey({
      orgSlug: organization.slug,
      limit: 3,
      ...parameters,
    }),
    {
      staleTime: 30000,
      enabled: defined(parameters.groupId) && enabled,
      ...options,
    }
  );
}
