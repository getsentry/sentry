import styled from '@emotion/styled';

import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import {GroupEventAttachmentsTableRow} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsTableRow';

const ATTACHMENT_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: '1fr'},
  {key: 'type', width: 'min-content'},
  {key: 'size', width: 'min-content'},
  {key: 'actions', width: 'min-content'},
];

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
      columns={ATTACHMENT_COLUMNS}
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
  margin-bottom: 0;

  .preview {
    padding: 0;
  }
  .preview-open {
    border-bottom: none;
  }
`;
