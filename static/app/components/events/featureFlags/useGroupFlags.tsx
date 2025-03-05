import {defined} from 'sentry/utils';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
  type UseApiQueryResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface FetchIssueFlagsParameters {
  environment: string[] | string | undefined;
  groupId: string;
  orgSlug: string;
  limit?: number;
}

const makeGroupFlagsQueryKey = ({
  groupId,
  orgSlug,
  environment,
  limit,
}: FetchIssueFlagsParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/tags/`,
  {query: {environment, limit, useFlagsBackend: '1'}},
];

export default function useGroupFlags(
  parameters: Omit<FetchIssueFlagsParameters, 'orgSlug'>,
  {enabled = true, ...options}: Partial<UseApiQueryOptions<GroupTag[]>> = {}
): UseApiQueryResult<GroupTag[], RequestError> {
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
