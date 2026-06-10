import {EventType, IncrementalSource, MouseInteractions} from '@sentry-internal/rrweb';
import type {ReplayOptionFrameEvent as TOptionFrameEvent} from '@sentry/react';
import invariant from 'invariant';

import type {
  BreadcrumbFrame,
  BreadcrumbFrameEvent,
  ConsoleFrame,
  ErrorFrame,
  FeedbackFrame,
  HydrationErrorFrame,
  MultiClickFrame,
  PaintFrame,
  RecordingFrame,
  ReplayFrame,
  SlowClickFrame,
  SpanFrame,
  SpanFrameEvent,
  VideoFrameEvent,
  WebVitalFrame,
} from 'sentry/utils/replays/types';

export function isRecordingFrame(
  attachment: Record<string, any>
): attachment is RecordingFrame {
  return 'type' in attachment && 'timestamp' in attachment;
}

export function isRRWebChangeFrame(frame: RecordingFrame) {
  return (
    frame.type === EventType.FullSnapshot ||
    (frame.type === EventType.IncrementalSnapshot &&
      frame.data.source === IncrementalSource.Mutation)
  );
}
export function isTouchStartFrame(frame: RecordingFrame) {
  return (
    frame.type === EventType.IncrementalSnapshot &&
    'type' in frame.data &&
    frame.data.type === MouseInteractions.TouchStart
  );
}

export function isTouchEndFrame(frame: RecordingFrame) {
  return (
    frame.type === EventType.IncrementalSnapshot &&
    'type' in frame.data &&
    frame.data.type === MouseInteractions.TouchEnd
  );
}

export function isTouchMoveFrame(frame: RecordingFrame) {
  return (
    frame.type === EventType.IncrementalSnapshot &&
    'source' in frame.data &&
    frame.data.source === IncrementalSource.TouchMove
  );
}

export function isMetaFrame(frame: RecordingFrame) {
  return frame.type === EventType.Meta;
}

export function isBreadcrumbFrameEvent(
  attachment: Record<string, any>
): attachment is BreadcrumbFrameEvent {
  return attachment.data?.tag === 'breadcrumb';
}

export function isSpanFrameEvent(
  attachment: Record<string, any>
): attachment is SpanFrameEvent {
  return attachment.data?.tag === 'performanceSpan';
}

export function isOptionFrameEvent(
  attachment: Record<string, any>
): attachment is TOptionFrameEvent {
  return attachment.data?.tag === 'options';
}

export function isVideoFrameEvent(
  attachment: Record<string, any>
): attachment is VideoFrameEvent {
  return attachment.type === EventType.Custom && attachment.data.tag === 'video';
}

export function isBreadcrumbFrame(
  frame: ReplayFrame | undefined
): frame is BreadcrumbFrame {
  return Boolean(frame && 'category' in frame && frame.category !== 'issue');
}

export function isFeedbackFrame(frame: ReplayFrame | undefined): frame is FeedbackFrame {
  return Boolean(frame && 'category' in frame && frame.category === 'feedback');
}

export function isHydrateCrumb(item: unknown): item is BreadcrumbFrame {
  return (
    typeof item === 'object' &&
    item !== null &&
    'category' in item &&
    item.category === 'replay.hydrate-error'
  );
}

export function isSpanFrame(frame: ReplayFrame | undefined): frame is SpanFrame {
  return Boolean(frame && 'op' in frame);
}

export function isErrorFrame(frame: ReplayFrame | undefined): frame is ErrorFrame {
  return Boolean(frame && 'category' in frame && frame.category === 'issue');
}

export function getFrameOpOrCategory(frame: ReplayFrame) {
  const val = ('op' in frame && frame.op) || ('category' in frame && frame.category);
  invariant(val, 'Frame has no category or op');
  return val;
}

export function getNodeIds(frame: ReplayFrame) {
  return 'data' in frame && frame.data && 'nodeId' in frame.data
    ? [frame.data.nodeId]
    : 'data' in frame && frame.data && 'nodeIds' in frame.data
      ? frame.data.nodeIds
      : undefined;
}

export function isConsoleFrame(frame: BreadcrumbFrame): frame is ConsoleFrame {
  if (frame.category === 'console') {
    frame.data = frame.data ?? {};
    return true;
  }
  return false;
}

export function isWebVitalFrame(frame: ReplayFrame): frame is WebVitalFrame {
  return isSpanFrame(frame) && frame.op === 'web-vital';
}

export function isCLSFrame(frame: WebVitalFrame): frame is WebVitalFrame {
  return frame.description === 'cumulative-layout-shift';
}

export function isPaintFrame(frame: SpanFrame): frame is PaintFrame {
  return frame.op === 'paint';
}

export function isDeadClick(frame: SlowClickFrame) {
  return (
    ['a', 'button', 'input'].includes(frame.data.node?.tagName.toLowerCase() ?? '') &&
    frame.data.endReason === 'timeout'
  );
}

export function isDeadRageClick(frame: SlowClickFrame) {
  return Boolean(
    isDeadClick(frame) && frame.data.clickCount && frame.data.clickCount >= 5
  );
}

export function isRageClick(frame: MultiClickFrame) {
  return frame.data.clickCount >= 5;
}

export function isHydrationErrorFrame(
  frame: BreadcrumbFrame
): frame is HydrationErrorFrame {
  return frame.category === 'replay.hydrate-error';
}

// This list must match each of the categories used in `HydratedBreadcrumb` above
// and any app-specific types that we hydrate (ie: replay.init).
export const BreadcrumbCategories = [
  'console',
  'device.battery',
  'device.connectivity',
  'device.orientation',
  'feedback',
  'navigation',
  'replay.init',
  'replay.mutations',
  'replay.hydrate-error',
  'ui.blur',
  'ui.click',
  'ui.tap',
  'ui.swipe',
  'ui.scroll',
  'ui.focus',
  'ui.input',
  'ui.keyDown',
  'ui.multiClick',
  'ui.slowClickDetected',
  'app.foreground',
  'app.background',
];
