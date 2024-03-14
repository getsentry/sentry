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
      if (attachment.data.payload.category === 'sentry.feedback') {
        // @ts-expect-error In SDK <= 7.100.0 we were incorrectly setting the timestamp
        attachment.data.payload.timestamp = attachment.data.timestamp;
      }
      breadcrumbFrames.push(attachment.data.payload);
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
