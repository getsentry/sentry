import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';

export type ViewerProps = {
  attachment: EventAttachment;
  eventId: Event['id'];
  orgSlug: string;
  projectSlug: string;
  className?: string;
};

export function getAttachmentUrl(props: ViewerProps, withPrefix?: boolean): string {
  const {orgSlug, projectSlug, eventId, attachment} = props;
  return `${
    withPrefix ? '/api/0' : ''
  }/projects/${orgSlug}/${projectSlug}/events/${eventId}/attachments/${
    attachment.id
  }/?download`;
}
