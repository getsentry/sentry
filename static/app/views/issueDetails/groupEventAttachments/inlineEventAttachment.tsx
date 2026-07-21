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
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

interface InlineAttachmentsProps {
  attachment: IssueAttachment;
  eventId: Event['id'];
  projectSlug: string;
}

interface AttachmentViewerProps {
  attachment: IssueAttachment;
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

function AttachmentViewer({
  attachment,
  orgSlug,
  projectSlug,
  eventId,
}: AttachmentViewerProps) {
  const commonProps = {attachment, orgSlug, projectSlug, eventId};

  if (nonPreviewableExtensions.some(ext => attachment.name.endsWith(ext))) {
    return null;
  }

  if (imageMimeTypes.includes(attachment.mimetype)) {
    return <ImageViewer {...commonProps} />;
  }
  if (webmMimeTypes.includes(attachment.mimetype)) {
    return <VideoViewer {...commonProps} />;
  }
  if (logFileMimeTypes.includes(attachment.mimetype)) {
    return <LogFileViewer {...commonProps} />;
  }
  if (jsonMimeTypes.includes(attachment.mimetype)) {
    if (attachment.name === 'rrweb.json' || attachment.name.startsWith('rrweb-')) {
      return <RRWebJsonViewer {...commonProps} />;
    }
    return <JsonViewer {...commonProps} />;
  }
  return null;
}

export function InlineEventAttachment({
  attachment,
  projectSlug,
  eventId,
}: InlineAttachmentsProps) {
  const organization = useOrganization();

  return (
    <AttachmentPreviewWrapper>
      <AttachmentViewer
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
