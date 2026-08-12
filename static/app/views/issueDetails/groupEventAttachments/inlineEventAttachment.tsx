import {AttachmentViewer} from 'sentry/components/events/attachmentViewers/attachmentViewer';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

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

  return (
    <AttachmentViewer
      orgSlug={organization.slug}
      projectSlug={projectSlug}
      eventId={eventId}
      attachment={attachment}
    />
  );
}
