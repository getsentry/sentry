import React from 'react';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {t} from 'app/locale';
import DateTime from 'app/components/dateTime';
import FileSize from 'app/components/fileSize';
import {EventAttachment} from 'app/types';
import AttachmentUrl from 'app/utils/attachmentUrl';
import EventAttachmentActions from 'app/components/events/eventAttachmentActions';
import {types} from 'app/views/organizationGroupDetails/groupEventAttachments/types';

type Props = {
  orgId: string;
  projectId: string;
  groupId: string;
  attachment: EventAttachment;
  onDelete: (attachmentId: string) => void;
  isDeleted: boolean;
};

const GroupEventAttachmentsTableRow = ({
  attachment,
  projectId,
  onDelete,
  isDeleted,
  orgId,
  groupId,
}: Props) => (
  <TableRow isDeleted={isDeleted}>
    <td>
      <h5>
        {attachment.name}
        <br />
        <small>
          <DateTime date={attachment.dateCreated} /> &middot;{' '}
          <Link
            to={`/organizations/${orgId}/issues/${groupId}/events/${attachment.event_id}/`}
          >
            {attachment.event_id}
          </Link>
        </small>
      </h5>
    </td>

    <td>{types[attachment.type] || t('Other')}</td>

    <td>
      <FileSize bytes={attachment.size} />
    </td>

    <td>
      <AttachmentUrl
        projectId={projectId}
        eventId={attachment.event_id}
        attachment={attachment}
      >
        {url =>
          !isDeleted && (
            <EventAttachmentActions
              url={url}
              onDelete={onDelete}
              attachmentId={attachment.id}
            />
          )
        }
      </AttachmentUrl>
    </td>
  </TableRow>
);

const TableRow = styled('tr')<{isDeleted: boolean}>`
  opacity: ${p => (p.isDeleted ? 0.3 : 1)};
  td {
    text-decoration: ${p => (p.isDeleted ? 'line-through' : 'normal')};
  }
`;

export default GroupEventAttachmentsTableRow;
