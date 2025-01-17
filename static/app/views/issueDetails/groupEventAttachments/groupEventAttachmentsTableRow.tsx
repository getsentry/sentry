import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import EventAttachmentActions from 'sentry/components/events/eventAttachmentActions';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';

const friendlyAttachmentType: Record<string, string> = {
  'event.minidump': t('Minidump'),
  'event.applecrashreport': t('Apple Crash Report'),
  'event.attachment': t('Other'),
};

type Props = {
  attachment: IssueAttachment;
  groupId: string;
  onDelete: (attachment: IssueAttachment) => void;
  projectSlug: string;
};

function GroupEventAttachmentsTableRow({
  attachment,
  projectSlug,
  onDelete,
  groupId,
}: Props) {
  const organization = useOrganization();
  const [previewIsOpen, setPreviewIsOpen] = useState(false);

  const handlePreviewClick = () => {
    setPreviewIsOpen(!previewIsOpen);
  };

  const sharedClassName = previewIsOpen ? 'preview-open' : undefined;

  return (
    <Fragment>
      <FlexCenter className={sharedClassName}>
        <div>
          <AttachmentName>{attachment.name}</AttachmentName>
          <div>
            <DateTime date={attachment.dateCreated} /> &middot;{' '}
            <Link
              to={`/organizations/${organization.slug}/issues/${groupId}/events/${attachment.event_id}/`}
            >
              <Tooltip skipWrapper title={t('View Event')}>
                {getShortEventId(attachment.event_id)}
              </Tooltip>
            </Link>
          </div>
        </div>
      </FlexCenter>
      <FlexCenter className={sharedClassName}>
        {friendlyAttachmentType[attachment.type] ?? t('Other')}
      </FlexCenter>
      <FlexCenter className={sharedClassName}>
        <FileSize bytes={attachment.size} />
      </FlexCenter>
      <FlexCenter className={sharedClassName}>
        <EventAttachmentActions
          withPreviewButton
          attachment={attachment}
          onDelete={() => onDelete(attachment)}
          onPreviewClick={handlePreviewClick}
          previewIsOpen={previewIsOpen}
          projectSlug={projectSlug}
        />
      </FlexCenter>
      {previewIsOpen && (
        <InlineAttachment className="preview">
          <InlineEventAttachment
            attachment={attachment}
            projectSlug={projectSlug}
            eventId={attachment.event_id}
          />
        </InlineAttachment>
      )}
    </Fragment>
  );
}

const AttachmentName = styled('div')`
  font-weight: bold;
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
`;

const InlineAttachment = styled('div')`
  grid-column: 1/-1;
`;

export default GroupEventAttachmentsTableRow;
