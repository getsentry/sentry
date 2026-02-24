import {skipToken} from '@tanstack/react-query';

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
  groupId: string | undefined;
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
      path: groupId
        ? {organizationIdOrSlug: organizationSlug, issueId: groupId}
        : skipToken,
      staleTime: 30_000,
      query,
    }
  );
}
