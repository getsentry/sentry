import styled from '@emotion/styled';

import {ImageViewer} from 'sentry/components/events/attachmentViewers/imageViewer';
import {JsonViewer} from 'sentry/components/events/attachmentViewers/jsonViewer';
import {LogFileViewer} from 'sentry/components/events/attachmentViewers/logFileViewer';
import {
  imageMimeTypes,
  jsonMimeTypes,
  logFileMimeTypes,
  nonPreviewableExtensions,
  webmMimeTypes,
} from 'sentry/components/events/attachmentViewers/previewAttachmentTypes';
import {RRWebJsonViewer} from 'sentry/components/events/attachmentViewers/rrwebJsonViewer';
import {VideoViewer} from 'sentry/components/events/attachmentViewers/videoViewer';
import {PanelItem} from 'sentry/components/panels/panelItem';
import type {IssueAttachment} from 'sentry/types/group';

interface AttachmentViewerProps {
  attachment: IssueAttachment;
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

export function AttachmentViewer(props: AttachmentViewerProps) {
  if (nonPreviewableExtensions.some(ext => props.attachment.name.endsWith(ext))) {
    return null;
  }

  if (imageMimeTypes.includes(props.attachment.mimetype)) {
    return (
      <AttachmentPreviewWrapper>
        <ImageViewer {...props} />
      </AttachmentPreviewWrapper>
    );
  }
  if (webmMimeTypes.includes(props.attachment.mimetype)) {
    return (
      <AttachmentPreviewWrapper>
        <VideoViewer {...props} />
      </AttachmentPreviewWrapper>
    );
  }
  if (logFileMimeTypes.includes(props.attachment.mimetype)) {
    return (
      <AttachmentPreviewWrapper>
        <LogFileViewer {...props} />
      </AttachmentPreviewWrapper>
    );
  }
  if (jsonMimeTypes.includes(props.attachment.mimetype)) {
    if (
      props.attachment.name === 'rrweb.json' ||
      props.attachment.name.startsWith('rrweb-')
    ) {
      return (
        <AttachmentPreviewWrapper>
          <RRWebJsonViewer {...props} />
        </AttachmentPreviewWrapper>
      );
    }
    return (
      <AttachmentPreviewWrapper>
        <JsonViewer {...props} />
      </AttachmentPreviewWrapper>
    );
  }
  return null;
}

const AttachmentPreviewWrapper = styled(PanelItem)`
  grid-column: auto / span 3;
  justify-content: center;
`;
