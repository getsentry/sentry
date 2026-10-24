import * as Sentry from '@sentry/react';

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

export function hydrateFrames(attachments: unknown[]) {
  const rrwebFrames: RecordingFrame[] = [];
  const breadcrumbFrames: RawBreadcrumbFrame[] = [];
  const spanFrames: RawSpanFrame[] = [];
  const videoFrames: VideoEvent[] = [];
  let optionFrame = undefined as OptionFrame | undefined;
  let breadcrumbsWithoutPayload = 0;

  attachments.forEach(attachment => {
    if (!attachment) {
      return;
    }
    if (isBreadcrumbFrameEvent(attachment)) {
      // SDK types require a payload, but some recordings arrive without one
      const payload = attachment.data.payload as RawBreadcrumbFrame | undefined;
      if (!payload) {
        breadcrumbsWithoutPayload++;
      } else if (payload.category !== 'sentry.feedback') {
        breadcrumbFrames.push(payload);
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

  if (breadcrumbsWithoutPayload > 0) {
    Sentry.logger.warn('Replay: dropped breadcrumb frames without a payload', {
      count: breadcrumbsWithoutPayload,
    });
  }

  return {
    breadcrumbFrames,
    optionFrame,
    rrwebFrames,
    spanFrames,
    videoFrames,
  };
}
