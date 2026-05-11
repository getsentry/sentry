import type {Client} from 'sentry/api';

export async function deleteExternalIssue(
  api: Client,
  orgSlug: string,
  groupId: string,
  externalIssueId: string
) {
  return await api.requestPromise(
    `/organizations/${orgSlug}/issues/${groupId}/external-issues/${externalIssueId}/`,
    {method: 'DELETE'}
  );
}
