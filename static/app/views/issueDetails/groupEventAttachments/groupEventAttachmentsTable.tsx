import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import {GroupEventAttachmentsTableRow} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsTableRow';

type Props = {
  attachments: IssueAttachment[];
  emptyMessage: string;
  groupId: string;
  isLoading: boolean;
  onDelete: (attachment: IssueAttachment) => void;
  projectSlug: string;
};

export function GroupEventAttachmentsTable({
  isLoading,
  attachments,
  projectSlug,
  groupId,
  emptyMessage,
  onDelete,
}: Props) {
  return (
    <AttachmentsSimpleTable
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Type')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Size')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Actions')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {isLoading && <SimpleTable.Loading />}
      {!isLoading && attachments.length === 0 && (
        <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
      )}
      {!isLoading &&
        attachments.map(attachment => (
          <GroupEventAttachmentsTableRow
            key={attachment.id}
            attachment={attachment}
            projectSlug={projectSlug}
            groupId={groupId}
            onDelete={onDelete}
          />
        ))}
    </AttachmentsSimpleTable>
  );
}

const AttachmentsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr repeat(3, min-content);
  margin-bottom: 0;

  .preview {
    padding: 0;
  }
  .preview-open {
    border-bottom: none;
  }
`;
