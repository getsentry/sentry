import type {
  OptionFrame,
  RawBreadcrumbFrame,
  RawSpanFrame,
  RecordingFrame,
  VideoEvent,
} from 'sentry/utils/replays/types';
import {
  isBreadcrumbFrameEvent,
  isOptionFrameEvent,
  isRecordingFrame,
  isSpanFrameEvent,
  isVideoFrameEvent,
} from 'sentry/utils/replays/types';

export default function hydrateFrames(attachments: unknown[]) {
  const rrwebFrames: RecordingFrame[] = [];
  const breadcrumbFrames: RawBreadcrumbFrame[] = [];
  const spanFrames: RawSpanFrame[] = [];
  const videoFrames: VideoEvent[] = [];
  let optionFrame = undefined as OptionFrame | undefined;

  attachments.forEach(attachment => {
    if (!attachment) {
      return;
    }
    if (isBreadcrumbFrameEvent(attachment)) {
      // Do not include feedback frames as breadcrumb frames.
      // They are now fetched and hydrated the same way as error frames.
      if (
        attachment.data.payload.category !== 'sentry.feedback' &&
        attachment.data.payload.category !== 'feedback'
      ) {
        breadcrumbFrames.push(attachment.data.payload);
      }
    } else if (isSpanFrameEvent(attachment)) {
      spanFrames.push(attachment.data.payload);
    } else if (isOptionFrameEvent(attachment)) {
      optionFrame = attachment.data.payload;
    } else if (isVideoFrameEvent(attachment) && attachment.data.payload.duration > 0) {
      videoFrames.push({
        duration: attachment.data.payload.duration,
        id: attachment.data.payload.segmentId,
        timestamp: attachment.timestamp,
      });
    } else if (isRecordingFrame(attachment)) {
      rrwebFrames.push(attachment);
    }
  });

  return {
    breadcrumbFrames,
    optionFrame,
    rrwebFrames,
    spanFrames,
    videoFrames,
  };
}
