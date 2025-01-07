import {defined} from 'sentry/utils';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

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
    /**
     * Available if `readable` query param is true
     * @deprecated - Use the frontend to get readable device names
     */
    readable?: string;
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
  /**
   * Readable formats mobile device names
   * TODO(scott): Can we do this in the frontend instead
   */
  readable?: boolean;
}

type GroupTagUseQueryOptions = Partial<UseApiQueryOptions<GroupTag[]>>;

const makeGroupTagsQueryKey = ({
  groupId,
  orgSlug,
  environment,
  readable,
  limit,
}: FetchIssueTagsParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/tags/`,
  {query: {environment, readable, limit}},
];

export function useGroupTags(
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug'>,
  {enabled = true, ...options}: GroupTagUseQueryOptions = {}
) {
  const organization = useOrganization();
  return useApiQuery<GroupTag[]>(
    makeGroupTagsQueryKey({
      orgSlug: organization.slug,
      ...parameters,
    }),
    {
      staleTime: 30000,
      enabled: defined(parameters.groupId) && enabled,
      ...options,
    }
  );
}

/**
 * Primarily used for tag facets
 */
export function useGroupTagsReadable(
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug' | 'readable'>,
  options: GroupTagUseQueryOptions = {}
) {
  return useGroupTags(
    {
      readable: true,
      limit: 3,
      ...parameters,
    },
    options
  );
}
