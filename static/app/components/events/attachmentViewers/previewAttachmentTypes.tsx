import ImageViewer from 'sentry/components/events/attachmentViewers/imageViewer';
import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';
import LogFileViewer from 'sentry/components/events/attachmentViewers/logFileViewer';
import type RRWebJsonViewer from 'sentry/components/events/attachmentViewers/rrwebJsonViewer';
import {WebMViewer} from 'sentry/components/events/attachmentViewers/webmViewer';
import type {IssueAttachment} from 'sentry/types/group';

export const imageMimeTypes = [
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const logFileMimeTypes = [
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/plain',
];

const jsonMimeTypes = [
  'application/json',
  'application/ld+json',
  'text/json',
  'text/x-json',
];

export const webmMimeType = 'video/webm';

type AttachmentRenderer =
  | typeof ImageViewer
  | typeof LogFileViewer
  | typeof RRWebJsonViewer
  | typeof WebMViewer;

export const getInlineAttachmentRenderer = (
  attachment: IssueAttachment
): AttachmentRenderer | undefined => {
  if (imageMimeTypes.includes(attachment.mimetype)) {
    return ImageViewer;
  }

  if (logFileMimeTypes.includes(attachment.mimetype)) {
    return LogFileViewer;
  }

  if (
    (jsonMimeTypes.includes(attachment.mimetype) && attachment.name === 'rrweb.json') ||
    attachment.name.startsWith('rrweb-')
  ) {
    return JsonViewer;
  }

  if (webmMimeType === attachment.mimetype) {
    return WebMViewer;
  }

  return undefined;
};

export const hasInlineAttachmentRenderer = (attachment: IssueAttachment): boolean => {
  return !!getInlineAttachmentRenderer(attachment);
};
