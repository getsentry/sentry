import {Client} from 'app/api';
import PlatformExternalIssueActions from 'app/actions/platformExternalIssueActions';

export async function deleteExternalIssue(
  api: Client,
  groupId: string,
  externalIssueId: string
) {
  PlatformExternalIssueActions.delete(groupId, externalIssueId);

  try {
    const data = await api.requestPromise(
      `/issues/${groupId}/external-issues/${externalIssueId}/`,
      {
        method: 'DELETE',
      }
    );

    PlatformExternalIssueActions.deleteSuccess(data);
    return data;
  } catch (error) {
    PlatformExternalIssueActions.deleteError(error);
    throw error;
  }
}
