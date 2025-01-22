import {
  EventType,
  type eventWithTime as TEventWithTime,
  IncrementalSource,
  MouseInteractions,
} from '@sentry-internal/rrweb';

import type {Event} from 'sentry/types/event';

export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';
export type {fullSnapshotEvent, incrementalSnapshotEvent} from '@sentry-internal/rrweb';

export {NodeType} from '@sentry-internal/rrweb-snapshot';
export {EventType, IncrementalSource} from '@sentry-internal/rrweb';

import type {
  ReplayBreadcrumbFrame as TRawBreadcrumbFrame,
  ReplayBreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  ReplayOptionFrameEvent as TOptionFrameEvent,
  ReplaySpanFrame as TRawSpanFrame,
  ReplaySpanFrameEvent as TSpanFrameEvent,
} from '@sentry/react';
import invariant from 'invariant';

export type Dimensions = {
  height: number;
  width: number;
};

// Extracting WebVitalFrame types from TRawSpanFrame so we can document/support
// the deprecated `nodeId` data field Moving forward, `nodeIds` is the accepted
// field.
type ReplayWebVitalFrameOps =
  | 'largest-contentful-paint'
  | 'cumulative-layout-shift'
  | 'first-input-delay'
  | 'interaction-to-next-paint';
type ReplayWebVitalFrameSdk = Extract<TRawSpanFrame, {op: ReplayWebVitalFrameOps}>;
/**
 * These are deprecated SDK fields that the UI needs to be
 * aware of to maintain backwards compatibility, i.e. for
 * replay recordings for SDK version < 8.22.0
 */
type DeprecatedReplayWebVitalFrameData = {
  nodeId?: number;
};
interface CompatibleReplayWebVitalFrame extends ReplayWebVitalFrameSdk {
  data: ReplayWebVitalFrameSdk['data'] & DeprecatedReplayWebVitalFrameData;
}

// These stub types should be coming from the sdk, but they're hard-coded until
// the SDK updates to the latest version... once that happens delete this!
// Needed for tests
// TODO[ryan953]: Remove this once the SDK is exporting the type as part of ReplayBreadcrumbFrame
export type RawHydrationErrorFrame = {
  category: 'replay.hydrate-error';
  timestamp: number;
  type: string;
  data?: {
    url?: string;
  };
  message?: string;
};

// These stub types should be coming from the sdk, but they're hard-coded until
// the SDK updates to the latest version... once that happens delete this!
type StubBreadcrumbTypes = RawHydrationErrorFrame;

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
      category: 'ui.swipe';
      data: any;
      timestamp: number;
      type: string;
      message?: string;
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
 * Extra breadcrumb types not included in `@sentry/replay`.
 * Also includes mobile types.
 * The navigation breadcrumb has data['from'] marked as optional
 * because the mobile SDK does not send that property currently.
 */
type ExtraBreadcrumbTypes =
  | StubBreadcrumbTypes
  | MobileBreadcrumbTypes
  | {
      category: 'navigation';
      data: {
        to: string;
        from?: string;
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
export type RawSpanFrame =
  | Exclude<TRawSpanFrame, {op: ReplayWebVitalFrameOps}>
  | CompatibleReplayWebVitalFrame;
export type SpanFrameEvent = TSpanFrameEvent;

export type CustomEvent<T = RecordingFrame> = T extends RecordingFrame & {
  type: EventType.Custom;
}
  ? T
  : never;

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

export function isHydrateCrumb(item: BreadcrumbFrame | Event): item is BreadcrumbFrame {
  return 'category' in item && item.category === 'replay.hydrate-error';
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

export function isWebVitalFrame(frame: SpanFrame): frame is WebVitalFrame {
  return frame.op === 'web-vital';
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

export function isBackgroundFrame(frame: ReplayFrame): frame is BreadcrumbFrame {
  return frame && 'category' in frame && frame.category === 'app.background';
}

export function isForegroundFrame(frame: ReplayFrame): frame is BreadcrumbFrame {
  return frame && 'category' in frame && frame.category === 'app.foreground';
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

export type ForegroundFrame = HydratedBreadcrumb<'app.foreground'>;
export type BackgroundFrame = HydratedBreadcrumb<'app.background'>;
export type BlurFrame = HydratedBreadcrumb<'ui.blur'>;
export type ClickFrame = HydratedBreadcrumb<'ui.click'>;
export type TapFrame = HydratedBreadcrumb<'ui.tap'>;
export type SwipeFrame = HydratedBreadcrumb<'ui.swipe'>;
export type ConsoleFrame = HydratedBreadcrumb<'console'>;
export type FocusFrame = HydratedBreadcrumb<'ui.focus'>;
export type InputFrame = HydratedBreadcrumb<'ui.input'>;
export type KeyboardEventFrame = HydratedBreadcrumb<'ui.keyDown'>;
export type MultiClickFrame = HydratedBreadcrumb<'ui.multiClick'>;
export type MutationFrame = HydratedBreadcrumb<'replay.mutations'>;
export type HydrationErrorFrame = Overwrite<
  HydratedBreadcrumb<'replay.hydrate-error'>,
  {
    data: {
      description: string;
      url?: string;
    };
  }
>;
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
  'feedback',
  'navigation',
  'replay.init',
  'replay.mutations',
  'replay.hydrate-error',
  'ui.blur',
  'ui.click',
  'ui.tap',
  'ui.swipe',
  'ui.focus',
  'ui.input',
  'ui.keyDown',
  'ui.multiClick',
  'ui.slowClickDetected',
  'app.foreground',
  'app.background',
];

// Spans
export type SpanFrame = Overwrite<TRawSpanFrame, HydratedStartEndDate>;
export type HistoryFrame = HydratedSpan<'navigation.push'>;
export type WebVitalFrame = HydratedSpan<
  | 'largest-contentful-paint'
  | 'cumulative-layout-shift'
  | 'first-input-delay'
  | 'interaction-to-next-paint'
>;
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
// And any app-specific types that we hydrate (ie: replay.end).
export const SpanOps = [
  'web-vital',
  'memory',
  'navigation.back_forward',
  'navigation.navigate',
  'navigation.push',
  'navigation.reload',
  'paint',
  'replay.end',
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
  ['error.type']: (string | undefined | null)[];
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

export type ReplayFrame = BreadcrumbFrame | ErrorFrame | SpanFrame;

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
