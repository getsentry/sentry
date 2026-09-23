import type {Client} from 'sentry/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export async function deleteExternalIssue(
  api: Client,
  orgSlug: string,
  groupId: string,
  externalIssueId: string
) {
  return await api.requestPromise(
    getApiUrl(
      '/organizations/$organizationIdOrSlug/issues/$issueId/external-issues/$externalIssueId/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          issueId: groupId,
          externalIssueId,
        },
      }
    ),
    {method: 'DELETE'}
  );
}
