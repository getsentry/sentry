import styled from '@emotion/styled';

import ImageViewer from 'app/components/events/attachmentViewers/imageViewer';
import JsonViewer from 'app/components/events/attachmentViewers/jsonViewer';
import LogFileViewer from 'app/components/events/attachmentViewers/logFileViewer';
import RRWebJsonViewer from 'app/components/events/attachmentViewers/rrwebJsonViewer';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  attachment: EventAttachment;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  event: Event;
};

function ScreenshotPreview({attachment, orgSlug, projectSlug, event}: Props) {
  switch (attachment.mimetype) {
    case 'text/plain':
      return attachment.size > 0 ? (
        <LogFileViewer
          attachment={attachment}
          orgId={orgSlug}
          projectId={projectSlug}
          event={event}
        />
      ) : null;
    case 'text/json':
    case 'text/x-json':
    case 'application/json':
      if (attachment.name === 'rrweb.json') {
        return (
          <RRWebJsonViewer
            attachment={attachment}
            orgId={orgSlug}
            projectId={projectSlug}
            event={event}
          />
        );
      }
      return (
        <JsonViewer
          attachment={attachment}
          orgId={orgSlug}
          projectId={projectSlug}
          event={event}
        />
      );
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
      return (
        <StyledImageViewer
          attachment={attachment}
          orgId={orgSlug}
          projectId={projectSlug}
          event={event}
        />
      );
    default:
      return null;
  }
}

export default ScreenshotPreview;

const StyledImageViewer = styled(ImageViewer)`
  padding: 0;
  height: 100%;
  img {
    width: auto;
    height: 100%;
    object-fit: cover;
    flex: 1;
  }
`;
