import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
  type UseApiQueryResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface FetchGroupFlagsParams {
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
}: FetchGroupFlagsParams): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/tags/', {
    path: {organizationIdOrSlug: orgSlug, issueId: groupId},
  }),
  {query: {environment, limit, useFlagsBackend: '1'}},
];

export default function useGroupFeatureFlags(
  parameters: Omit<FetchGroupFlagsParams, 'orgSlug'>,
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
