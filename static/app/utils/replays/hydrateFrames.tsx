import type {
  OptionFrame,
  RawBreadcrumbFrame,
  RawSpanFrame,
  RecordingFrame,
} from 'sentry/utils/replays/types';
import {
  isBreadcrumbFrameEvent,
  isOptionFrameEvent,
  isRecordingFrame,
  isSpanFrameEvent,
} from 'sentry/utils/replays/types';

export default function hydrateFrames(attachments: unknown[]) {
  const rrwebFrames: RecordingFrame[] = [];
  const breadcrumbFrames: RawBreadcrumbFrame[] = [];
  const spanFrames: RawSpanFrame[] = [];
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
    } else if (isRecordingFrame(attachment)) {
      rrwebFrames.push(attachment);
    }
  });

  return {
    breadcrumbFrames,
    optionFrame,
    rrwebFrames,
    spanFrames,
  };
}
