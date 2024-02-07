import type {EventAttachment} from 'sentry/types';
import type {Event} from 'sentry/types/event';

export type ViewerProps = {
  attachment: EventAttachment;
  eventId: Event['id'];
  orgId: string;
  projectSlug: string;
  className?: string;
};

export function getAttachmentUrl(props: ViewerProps, withPrefix?: boolean): string {
  const {orgId, projectSlug, eventId, attachment} = props;
  return `${
    withPrefix ? '/api/0' : ''
  }/projects/${orgId}/${projectSlug}/events/${eventId}/attachments/${
    attachment.id
  }/?download`;
}
