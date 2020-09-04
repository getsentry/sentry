import {Client} from 'app/api';
import PlatformExternalIssueActions from 'app/actions/platformExternalIssueActions';

export function deleteExternalIssue(
  api: Client,
  groupId: string,
  externalIssueId: string
) {
  PlatformExternalIssueActions.delete(groupId, externalIssueId);

  return new Promise((resolve, reject) =>
    api.request(`/issues/${groupId}/external-issues/${externalIssueId}/`, {
      method: 'DELETE',
      success: data => {
        PlatformExternalIssueActions.deleteSuccess(data);
        resolve(data);
      },
      error: error => {
        PlatformExternalIssueActions.deleteError(error);
        reject(error);
      },
    })
  );
}
