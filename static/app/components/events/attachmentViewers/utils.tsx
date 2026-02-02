import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';

export type ViewerProps = {
  attachment: EventAttachment;
  eventId: Event['id'];
  orgSlug: string;
  projectSlug: string;
  className?: string;
};

export function getAttachmentUrl(props: ViewerProps) {
  const {orgSlug, projectSlug, eventId, attachment} = props;

  return getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        eventId,
        attachmentId: attachment.id,
      },
    }
  );
}
