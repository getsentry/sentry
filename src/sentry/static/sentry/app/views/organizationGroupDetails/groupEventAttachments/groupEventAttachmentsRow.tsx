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
import space from 'app/styles/space';

type Props = {
  orgSlug: string;
  projectSlug: string;
  groupId: string;
  attachment: EventAttachment;
  onDelete: (attachmentId: string) => void;
  isDeleted: boolean;
};

const GroupEventAttachmentsRow = ({
  orgSlug,
  projectSlug,
  groupId,
  attachment,
  onDelete,
  isDeleted,
}: Props) => (
  <React.Fragment>
    <NameColumn>
      <Name>{attachment.name}</Name>
      <Meta>
        <DateTime date={attachment.dateCreated} /> &middot;{' '}
        <Link
          to={`/organizations/${orgSlug}/issues/${groupId}/events/${attachment.event_id}/`}
        >
          {attachment.event_id}
        </Link>
      </Meta>
    </NameColumn>

    <Column>{types[attachment.type] || t('Other')}</Column>

    <Column>
      <FileSize bytes={attachment.size} />
    </Column>

    <Column>
      <AttachmentUrl
        projectId={projectSlug}
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
    </Column>
  </React.Fragment>
);

const Column = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const NameColumn = styled(Column)`
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;

const Name = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1;
  margin-bottom: ${space(0.25)};
`;
const Meta = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
`;

export default GroupEventAttachmentsRow;
