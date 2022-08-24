import {Client} from 'sentry/api';

export async function deleteExternalIssue(
  api: Client,
  groupId: string,
  externalIssueId: string
) {
  return await api.requestPromise(
    `/issues/${groupId}/external-issues/${externalIssueId}/`,
    {method: 'DELETE'}
  );
}
