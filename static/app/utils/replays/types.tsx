import type {eventWithTime as TEventWithTime} from '@sentry-internal/rrweb';

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

import {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';

/**
 * Extra breadcrumb types not included in `@sentry/replay`
 */
type ExtraBreadcrumbTypes = {
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

export function isBreadcrumbFrame(
  frame: ReplayFrame | undefined
): frame is BreadcrumbFrame {
  return Boolean(frame && 'category' in frame && frame.category !== 'issue');
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
  TRawBreadcrumbFrame | ExtraBreadcrumbTypes,
  HydratedTimestamp
>;
export type BlurFrame = HydratedBreadcrumb<'ui.blur'>;
export type ClickFrame = HydratedBreadcrumb<'ui.click'>;
export type ConsoleFrame = HydratedBreadcrumb<'console'>;
export type FocusFrame = HydratedBreadcrumb<'ui.focus'>;
export type InputFrame = HydratedBreadcrumb<'ui.input'>;
export type KeyboardEventFrame = HydratedBreadcrumb<'ui.keyDown'>;
export type MultiClickFrame = HydratedBreadcrumb<'ui.multiClick'>;
export type MutationFrame = HydratedBreadcrumb<'replay.mutations'>;
export type NavFrame = HydratedBreadcrumb<'navigation'>;
export type SlowClickFrame = HydratedBreadcrumb<'ui.slowClickDetected'>;

// This list must match each of the categories used in `HydratedBreadcrumb` above
// and any app-specific types that we hydrate (ie: replay.init).
export const BreadcrumbCategories = [
  'console',
  'navigation',
  'replay.init',
  'replay.mutations',
  'ui.blur',
  'ui.click',
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
export type RequestFrame = HydratedSpan<'resource.fetch' | 'resource.xhr'>;
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
