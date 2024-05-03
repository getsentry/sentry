import {EventType, type eventWithTime as TEventWithTime} from '@sentry-internal/rrweb';

export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';
export type {fullSnapshotEvent} from '@sentry-internal/rrweb';

export {NodeType} from '@sentry-internal/rrweb-snapshot';
export {EventType} from '@sentry-internal/rrweb';

import type {
  ReplayBreadcrumbFrame as TRawBreadcrumbFrame,
  ReplayBreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  ReplayOptionFrameEvent as TOptionFrameEvent,
  ReplaySpanFrame as TRawSpanFrame,
  ReplaySpanFrameEvent as TSpanFrameEvent,
} from '@sentry/react';
import invariant from 'invariant';

import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';

// TODO: more types get added here
type MobileBreadcrumbTypes =
  | {
      category: 'ui.tap';
      data: any;
      message: string;
      timestamp: number;
      type: string;
    }
  | {
      category: 'device.battery';
      data: {charging: boolean; level: number};
      timestamp: number;
      type: string;
      message?: string;
    }
  | {
      category: 'device.connectivity';
      data: {state: 'offline' | 'wifi' | 'cellular' | 'ethernet'};
      timestamp: number;
      type: string;
      message?: string;
    }
  | {
      category: 'device.orientation';
      data: {position: 'landscape' | 'portrait'};
      timestamp: number;
      type: string;
      message?: string;
    };

/**
 * Extra breadcrumb types not included in `@sentry/replay`
 * Also includes mobile types
 */
type ExtraBreadcrumbTypes =
  | MobileBreadcrumbTypes
  | {
      category: 'navigation';
      data: {
        from: string;
        to: string;
      };
      message: string;
      timestamp: number;
      type: string; // For compatibility reasons
    };

export type RawBreadcrumbFrame = TRawBreadcrumbFrame | ExtraBreadcrumbTypes;
export type BreadcrumbFrameEvent = TBreadcrumbFrameEvent;
export type RecordingFrame = TEventWithTime;
export type OptionFrame = TOptionFrameEvent['data']['payload'];
export type OptionFrameEvent = TOptionFrameEvent;
export type RawSpanFrame = TRawSpanFrame;
export type SpanFrameEvent = TSpanFrameEvent;

export function isRecordingFrame(
  attachment: Record<string, any>
): attachment is RecordingFrame {
  return 'type' in attachment && 'timestamp' in attachment;
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

export function getNodeId(frame: ReplayFrame) {
  return 'data' in frame && frame.data && 'nodeId' in frame.data
    ? frame.data.nodeId
    : undefined;
}

export function isConsoleFrame(frame: BreadcrumbFrame): frame is ConsoleFrame {
  if (frame.category === 'console') {
    frame.data = frame.data ?? {};
    return true;
  }
  return false;
}

export function isLCPFrame(frame: SpanFrame): frame is LargestContentfulPaintFrame {
  return frame.op === 'largest-contentful-paint';
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

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type HydratedTimestamp = {
  /**
   * The difference in timestamp and replay.started_at, in millieseconds
   */
  offsetMs: number;
  /**
   * The Date when the breadcrumb happened
   */
  timestamp: Date;
  /**
   * Alias of timestamp, in milliseconds
   */
  timestampMs: number;
};

type HydratedBreadcrumb<Category extends string> = Overwrite<
  Extract<TRawBreadcrumbFrame | ExtraBreadcrumbTypes, {category: Category}>,
  HydratedTimestamp
>;

type HydratedStartEndDate = {
  /**
   * The end Date of the span
   */
  endTimestamp: Date;
  /**
   * Alias of endTimestamp, in milliseconds
   */
  endTimestampMs: number;
  /**
   * The difference in startTimestamp and replay.started_at, in millieseconds
   */
  offsetMs: number;
  /**
   * The start Date of the span
   *
   * See also timestampMs
   */
  startTimestamp: Date;
  /**
   * Alias of startTimestamp, in milliseconds
   *
   * Included to make sorting with `HydratedBreadcrumb` easier
   */
  timestampMs: number;
};
type HydratedSpan<Op extends string> = Overwrite<
  Extract<TRawSpanFrame, {op: Op}>,
  HydratedStartEndDate // TODO: do we need `{id:string}` added too?
>;

// Breadcrumbs
export type BreadcrumbFrame = Overwrite<
  TRawBreadcrumbFrame | ExtraBreadcrumbTypes | FeedbackFrame,
  HydratedTimestamp
>;

export type FeedbackFrame = {
  category: 'feedback';
  data: {
    eventId: string;
    groupId: number;
    groupShortId: string;
    label: string;
    labels: string[];
    projectSlug: string;
  };
  message: string;
  offsetMs: number;
  timestamp: Date;
  timestampMs: number;
  type: string;
};

export type BlurFrame = HydratedBreadcrumb<'ui.blur'>;
export type ClickFrame = HydratedBreadcrumb<'ui.click'>;
export type TapFrame = HydratedBreadcrumb<'ui.tap'>;
export type ConsoleFrame = HydratedBreadcrumb<'console'>;
export type FocusFrame = HydratedBreadcrumb<'ui.focus'>;
export type InputFrame = HydratedBreadcrumb<'ui.input'>;
export type KeyboardEventFrame = HydratedBreadcrumb<'ui.keyDown'>;
export type MultiClickFrame = HydratedBreadcrumb<'ui.multiClick'>;
export type MutationFrame = HydratedBreadcrumb<'replay.mutations'>;
export type NavFrame = HydratedBreadcrumb<'navigation'>;
export type SlowClickFrame = HydratedBreadcrumb<'ui.slowClickDetected'>;
export type DeviceBatteryFrame = HydratedBreadcrumb<'device.battery'>;
export type DeviceConnectivityFrame = HydratedBreadcrumb<'device.connectivity'>;
export type DeviceOrientationFrame = HydratedBreadcrumb<'device.orientation'>;

// This list must match each of the categories used in `HydratedBreadcrumb` above
// and any app-specific types that we hydrate (ie: replay.init).
export const BreadcrumbCategories = [
  'console',
  'device.battery',
  'device.connectivity',
  'device.orientation',
  'navigation',
  'replay.init',
  'replay.mutations',
  'replay.hydrate-error',
  'ui.blur',
  'ui.click',
  'ui.tap',
  'ui.focus',
  'ui.input',
  'ui.keyDown',
  'ui.multiClick',
  'ui.slowClickDetected',
];

// Spans
export type SpanFrame = Overwrite<TRawSpanFrame, HydratedStartEndDate>;
export type HistoryFrame = HydratedSpan<'navigation.push'>;
export type LargestContentfulPaintFrame = HydratedSpan<'largest-contentful-paint'>;
export type MemoryFrame = HydratedSpan<'memory'>;
export type NavigationFrame = HydratedSpan<
  'navigation.navigate' | 'navigation.reload' | 'navigation.back_forward'
>;
export type PaintFrame = HydratedSpan<'paint'>;
export type RequestFrame = HydratedSpan<
  'resource.fetch' | 'resource.xhr' | 'resource.http'
>;
export type ResourceFrame = HydratedSpan<
  | 'resource.css'
  | 'resource.iframe'
  | 'resource.img'
  | 'resource.link'
  | 'resource.other'
  | 'resource.script'
>;

// This list should match each of the operations used in `HydratedSpan` above
// And any app-specific types that we hydrate (ie: replay.start & replay.end).
export const SpanOps = [
  'largest-contentful-paint',
  'memory',
  'navigation.back_forward',
  'navigation.navigate',
  'navigation.push',
  'navigation.reload',
  'paint',
  'replay.end',
  'replay.start',
  'resource.css',
  'resource.fetch',
  'resource.iframe',
  'resource.img',
  'resource.link',
  'resource.other',
  'resource.script',
  'resource.xhr',
  'resource.http',
];

/**
 * This is a result of a custom discover query
 */
export type RawReplayError = {
  ['error.type']: Array<string | undefined | null>;
  id: string;
  issue: string;
  ['issue.id']: number;
  ['project.name']: string;
  timestamp: string;
  title: string;
};

export type ErrorFrame = Overwrite<
  BreadcrumbFrame,
  {
    category: 'issue';
    data: {
      eventId: string;
      groupId: number;
      groupShortId: string;
      label: string;
      labels: string[];
      projectSlug: string;
    };
    message: string;
  }
>;

export type ReplayFrame = BreadcrumbFrame | ErrorFrame | SpanFrame | HydratedA11yFrame;

interface VideoFrame {
  container: string;
  duration: number;
  encoding: string;
  frameCount: number;
  frameRate: number;
  frameRateType: string;
  height: number;
  left: number;
  segmentId: number;
  size: number;
  top: number;
  width: number;
}

export interface VideoFrameEvent {
  data: {
    payload: VideoFrame;
    tag: 'video';
  };
  timestamp: number;
  type: EventType.Custom;
}

export interface VideoEvent {
  duration: number;
  id: number;
  timestamp: number;
}

export interface ClipWindow {
  endTimestampMs: number;
  startTimestampMs: number;
}
