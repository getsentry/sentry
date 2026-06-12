import {ImageViewer} from 'sentry/components/events/attachmentViewers/imageViewer';
import {JsonViewer} from 'sentry/components/events/attachmentViewers/jsonViewer';
import {LogFileViewer} from 'sentry/components/events/attachmentViewers/logFileViewer';
import {RRWebJsonViewer} from 'sentry/components/events/attachmentViewers/rrwebJsonViewer';
import {VideoViewer} from 'sentry/components/events/attachmentViewers/videoViewer';
import type {IssueAttachment} from 'sentry/types/group';

export const imageMimeTypes = [
  'application/octet-stream',
  'application/png',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
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

export const webmMimeTypes = ['video/webm', 'video/mp4'];

type AttachmentRenderer =
  | typeof ImageViewer
  | typeof LogFileViewer
  | typeof RRWebJsonViewer
  | typeof VideoViewer;

export const getImageAttachmentRenderer = (
  attachment: IssueAttachment
): AttachmentRenderer | undefined => {
  if (imageMimeTypes.includes(attachment.mimetype)) {
    return ImageViewer;
  }
  if (webmMimeTypes.includes(attachment.mimetype)) {
    return VideoViewer;
  }
  return undefined;
};

const nonPreviewableExtensions = ['.prosperodmp', '.prosperomemdmp'];

export const getInlineAttachmentRenderer = (
  attachment: IssueAttachment
): AttachmentRenderer | undefined => {
  if (nonPreviewableExtensions.some(ext => attachment.name.endsWith(ext))) {
    return undefined;
  }

  const imageAttachmentRenderer = getImageAttachmentRenderer(attachment);
  if (imageAttachmentRenderer) {
    return imageAttachmentRenderer;
  }

  if (logFileMimeTypes.includes(attachment.mimetype)) {
    return LogFileViewer;
  }

  if (jsonMimeTypes.includes(attachment.mimetype)) {
    if (attachment.name === 'rrweb.json' || attachment.name.startsWith('rrweb-')) {
      return RRWebJsonViewer;
    }

    return JsonViewer;
  }

  return undefined;
};

export const hasInlineAttachmentRenderer = (attachment: IssueAttachment): boolean => {
  return !!getInlineAttachmentRenderer(attachment);
};

const MAX_TEXT_PREVIEW_SIZE = 20 * 1024 * 1024; // 20 MiB

export const isAttachmentTooLargeForPreview = (attachment: IssueAttachment): boolean => {
  if (getImageAttachmentRenderer(attachment)) {
    return false;
  }
  return attachment.size > MAX_TEXT_PREVIEW_SIZE;
};
