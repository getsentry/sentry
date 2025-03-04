import {defined} from 'sentry/utils';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  FetchIssueTagsParameters,
  GroupTag,
  GroupTagUseQueryOptions,
} from 'sentry/views/issueDetails/groupTags/useGroupTags';

const makeGroupFlagsQueryKey = ({
  groupId,
  orgSlug,
  environment,
  readable,
  limit,
}: FetchIssueTagsParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/tags/`,
  {query: {environment, readable, limit, useFlagsBackend: '1'}},
];

export default function useGroupFlags(
  parameters: Omit<FetchIssueTagsParameters, 'orgSlug'>,
  {enabled = true, ...options}: GroupTagUseQueryOptions = {}
) {
  const organization = useOrganization();
  return useApiQuery<GroupTag[]>(
    makeGroupFlagsQueryKey({
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
