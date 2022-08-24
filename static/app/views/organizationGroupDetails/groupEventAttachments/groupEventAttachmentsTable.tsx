import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types';
import GroupEventAttachmentsTableRow from 'sentry/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow';

type Props = {
  attachments: IssueAttachment[];
  deletedAttachments: string[];
  groupId: string;
  onDelete: (attachmentId: string) => void;
  orgId: string;
  projectId: string;
};

const GroupEventAttachmentsTable = ({
  attachments,
  orgId,
  projectId,
  groupId,
  onDelete,
  deletedAttachments,
}: Props) => {
  const tableRowNames = [t('Name'), t('Type'), t('Size'), t('Actions')];

  return (
    <table className="table events-table">
      <thead>
        <tr>
          {tableRowNames.map(name => (
            <th key={name}>{name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {attachments.map(attachment => (
          <GroupEventAttachmentsTableRow
            key={attachment.id}
            attachment={attachment}
            orgId={orgId}
            projectId={projectId}
            groupId={groupId}
            onDelete={onDelete}
            isDeleted={deletedAttachments.some(id => attachment.id === id)}
          />
        ))}
      </tbody>
    </table>
  );
};

export default GroupEventAttachmentsTable;
