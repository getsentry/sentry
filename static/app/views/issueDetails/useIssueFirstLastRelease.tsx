import {skipToken} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

type FirstLastReleaseQuery = {
  environment?: string[];
};

interface IssueFirstLastReleaseQueryOptions {
  groupId: string | undefined;
  organizationSlug: string;
  query?: FirstLastReleaseQuery;
}

function issueFirstLastReleaseQueryOptions({
  groupId,
  organizationSlug,
  query,
}: IssueFirstLastReleaseQueryOptions) {
  return apiOptions.as<GroupRelease>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/first-last-release/',
    {
      path: groupId
        ? {organizationIdOrSlug: organizationSlug, issueId: groupId}
        : skipToken,
      staleTime: 30_000,
      query,
    }
  );
}

interface UseIssueFirstLastReleaseOptions {
  group: Group | undefined;
  query?: FirstLastReleaseQuery;
}

export function useIssueFirstLastRelease({
  group,
  query,
}: UseIssueFirstLastReleaseOptions) {
  const organization = useOrganization();
  return useQuery(
    issueFirstLastReleaseQueryOptions({
      groupId: group?.id,
      organizationSlug: organization.slug,
      query,
    })
  );
}
