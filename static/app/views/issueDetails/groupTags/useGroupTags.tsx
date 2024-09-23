import type {Tag} from 'sentry/actionCreators/events';
import type {GroupTagsResponse} from 'sentry/actionCreators/group';
import {defined} from 'sentry/utils';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type FetchIssueTagsParameters = {
  environment: string[];
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
};

type GroupTagUseQueryOptions = Partial<UseApiQueryOptions<GroupTagsResponse | Tag[]>>;

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
  return useApiQuery<GroupTagsResponse | Tag[]>(
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
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug' | 'limit' | 'readable'>,
  options: GroupTagUseQueryOptions = {}
) {
  return useGroupTags(
    {
      readable: true,
      limit: 4,
      ...parameters,
    },
    options
  );
}
