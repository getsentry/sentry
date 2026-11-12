import type {UseQueryResult} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface FetchGroupFlagsParams {
  environment: string[] | string | undefined;
  groupId: string;
  orgSlug: string;
  limit?: number;
}

const groupFlagsOptions = ({
  groupId,
  orgSlug,
  environment,
  limit,
}: FetchGroupFlagsParams) =>
  apiOptions.as<GroupTag[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/tags/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId},
      query: {environment, limit, useFlagsBackend: '1'},
      staleTime: 30000,
    }
  );

export function useGroupFeatureFlags(
  parameters: Omit<FetchGroupFlagsParams, 'orgSlug'>
): UseQueryResult<GroupTag[]> {
  const organization = useOrganization();
  return useQuery({
    ...groupFlagsOptions({
      orgSlug: organization.slug,
      ...parameters,
    }),
    enabled: defined(parameters.groupId),
  });
}
