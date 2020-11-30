import {Event, EventAttachment} from 'app/types';

export type ViewerProps = {
  event: Event;
  orgId: string;
  projectId: string;
  attachment: EventAttachment;
};

export function getAttachmentUrl(props: ViewerProps, withPrefix?: boolean): string {
  const {orgId, projectId, event, attachment} = props;
  return `${withPrefix ? '/api/0' : ''}/projects/${orgId}/${projectId}/events/${
    event.id
  }/attachments/${attachment.id}/?download`;
}
