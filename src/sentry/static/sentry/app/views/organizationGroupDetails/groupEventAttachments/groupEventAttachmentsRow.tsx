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
import Checkbox from 'app/components/checkbox';

type Props = {
  orgSlug: string;
  projectSlug: string;
  groupId: string;
  attachment: EventAttachment;
  onDelete: (attachmentId: string) => void;
  isSelected: boolean;
  onSelectToggle: (id: string) => void;
};

const GroupEventAttachmentsRow = ({
  orgSlug,
  projectSlug,
  groupId,
  attachment,
  onDelete,
  isSelected,
  onSelectToggle,
}: Props) => {
  const toggleRow = (
    e: React.MouseEvent<HTMLDivElement> | React.FormEvent<HTMLInputElement>
  ) => {
    if (e.currentTarget.tagName === 'INPUT') {
      return;
    }

    onSelectToggle(attachment.id);
  };

  return (
    <React.Fragment>
      <Column onClick={toggleRow}>
        <StyledCheckbox checked={isSelected} onChange={toggleRow} />
      </Column>

      <NameColumn onClick={toggleRow}>
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

      <Column onClick={toggleRow}>{types[attachment.type] || t('Other')}</Column>

      <Column onClick={toggleRow}>
        <FileSize bytes={attachment.size} />
      </Column>

      <ActionsColumn>
        <AttachmentUrl
          projectId={projectSlug}
          eventId={attachment.event_id}
          attachment={attachment}
        >
          {url => (
            <EventAttachmentActions
              url={url}
              onDelete={onDelete}
              attachmentId={attachment.id}
            />
          )}
        </AttachmentUrl>
      </ActionsColumn>
    </React.Fragment>
  );
};

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

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

const StyledCheckbox = styled(Checkbox)`
  margin: 0 !important; /* override less files */
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
