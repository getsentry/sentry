import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

interface FirstLastReleaseQueryOptions {
  environment?: string[];
}

interface GetIssueFirstLastReleaseQueryOptions {
  groupId: string;
  organizationSlug: string;
  query?: FirstLastReleaseQueryOptions;
}

export function issueFirstLastReleaseQueryOptions({
  groupId,
  organizationSlug,
  query,
}: GetIssueFirstLastReleaseQueryOptions) {
  return apiOptions.as<GroupRelease>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/first-last-release/',
    {
      path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
      staleTime: 30_000,
      query,
    }
  );
}
