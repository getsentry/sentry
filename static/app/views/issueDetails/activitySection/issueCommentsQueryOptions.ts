import type {GroupActivity} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface IssueCommentsQueryOptionsParameters {
  groupId: string;
  organizationSlug: string;
}

export function issueCommentsQueryOptions({
  groupId,
  organizationSlug,
}: IssueCommentsQueryOptionsParameters) {
  return apiOptions.as<GroupActivity[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/comments/',
    {
      path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
      query: {per_page: 100},
      staleTime: 30_000,
    }
  );
}
