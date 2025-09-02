import styled from '@emotion/styled';

import {getInlineAttachmentRenderer} from 'sentry/components/events/attachmentViewers/previewAttachmentTypes';
import PanelItem from 'sentry/components/panels/panelItem';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';

interface InlineAttachmentsProps {
  attachment: IssueAttachment;
  eventId: Event['id'];
  projectSlug: string;
}

export function InlineEventAttachment({
  attachment,
  projectSlug,
  eventId,
}: InlineAttachmentsProps) {
  const organization = useOrganization();
  const AttachmentComponent = getInlineAttachmentRenderer(attachment);

  if (!AttachmentComponent) {
    return null;
  }

  return (
    <AttachmentPreviewWrapper>
      <AttachmentComponent
        orgSlug={organization.slug}
        projectSlug={projectSlug}
        eventId={eventId}
        attachment={attachment}
      />
    </AttachmentPreviewWrapper>
  );
}

const AttachmentPreviewWrapper = styled(PanelItem)`
  grid-column: auto / span 3;
  justify-content: center;
`;
