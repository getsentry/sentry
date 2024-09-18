import ImageViewer from 'sentry/components/events/attachmentViewers/imageViewer';
import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';
import LogFileViewer from 'sentry/components/events/attachmentViewers/logFileViewer';
import RRWebJsonViewer from 'sentry/components/events/attachmentViewers/rrwebJsonViewer';
import type {IssueAttachment} from 'sentry/types/group';

export const getInlineAttachmentRenderer = (
  attachment: IssueAttachment
): typeof ImageViewer | typeof LogFileViewer | typeof RRWebJsonViewer | undefined => {
  switch (attachment.mimetype) {
    case 'text/css':
    case 'text/csv':
    case 'text/html':
    case 'text/javascript':
    case 'text/plain':
      return attachment.size > 0 ? LogFileViewer : undefined;
    case 'application/json':
    case 'application/ld+json':
    case 'text/json':
    case 'text/x-json':
      if (attachment.name === 'rrweb.json' || attachment.name.startsWith('rrweb-')) {
        return RRWebJsonViewer;
      }
      return JsonViewer;
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
      return ImageViewer;
    default:
      return undefined;
  }
};

export const hasInlineAttachmentRenderer = (attachment: IssueAttachment): boolean => {
  return !!getInlineAttachmentRenderer(attachment);
};
