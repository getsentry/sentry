import {EventAttachment} from 'app/types';
import {Event} from 'app/types/event';

export type ViewerProps = {
  event: Event;
  orgId: string;
  projectId: string;
  attachment: EventAttachment;
  className?: string;
};

export function getAttachmentUrl(props: ViewerProps, withPrefix?: boolean): string {
  const {orgId, projectId, event, attachment} = props;
  return `${withPrefix ? '/api/0' : ''}/projects/${orgId}/${projectId}/events/${
    event.id
  }/attachments/${attachment.id}/?download`;
}
