import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAttachment} from 'sentry/types/group';
import GroupEventAttachmentsTableRow from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsTableRow';

type Props = {
  attachments: IssueAttachment[];
  emptyMessage: string;
  groupId: string;
  isLoading: boolean;
  onDelete: (attachment: IssueAttachment) => void;
  projectSlug: string;
};

function GroupEventAttachmentsTable({
  isLoading,
  attachments,
  projectSlug,
  groupId,
  emptyMessage,
  onDelete,
}: Props) {
  return (
    <AttachmentsPanelTable
      isLoading={isLoading}
      isEmpty={attachments.length === 0}
      emptyMessage={emptyMessage}
      headers={[t('Name'), t('Type'), t('Size'), t('Actions')]}
    >
      {attachments.map(attachment => (
        <GroupEventAttachmentsTableRow
          key={attachment.id}
          attachment={attachment}
          projectSlug={projectSlug}
          groupId={groupId}
          onDelete={onDelete}
        />
      ))}
    </AttachmentsPanelTable>
  );
}

export default GroupEventAttachmentsTable;

const AttachmentsPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(3, min-content);
  margin-bottom: 0;

  & > :last-child {
    padding: ${p => (p.isEmpty ? space(4) : undefined)};
  }

  .preview {
    padding: 0;
  }
  .preview-open {
    border-bottom: none;
  }
`;
