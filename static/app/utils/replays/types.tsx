import type {eventWithTime as TEventWithTime} from '@sentry-internal/rrweb';

export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';
export type {fullSnapshotEvent} from '@sentry-internal/rrweb';

export {NodeType} from '@sentry-internal/rrweb-snapshot';
export {EventType} from '@sentry-internal/rrweb';

import type {
  BreadcrumbFrame as TRawBreadcrumbFrame,
  BreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  OptionFrameEvent as TOptionFrameEvent,
  SpanFrame as TRawSpanFrame,
  SpanFrameEvent as TSpanFrameEvent,
} from '@sentry/replay';
import invariant from 'invariant';

export type RawBreadcrumbFrame = TRawBreadcrumbFrame;
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

export function frameOpOrCategory(frame: BreadcrumbFrame | SpanFrame | ErrorFrame) {
  const val = ('op' in frame && frame.op) || ('category' in frame && frame.category);
  invariant(val, 'Frame has no category or op');
  return val;
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
  Extract<TRawBreadcrumbFrame, {category: Category}>,
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
export type BreadcrumbFrame = Overwrite<TRawBreadcrumbFrame, HydratedTimestamp>;
export type ConsoleFrame = HydratedBreadcrumb<'console'>;
export type ClickFrame = HydratedBreadcrumb<'ui.click'>;
export type InputFrame = HydratedBreadcrumb<'ui.input'>;
export type MutationFrame = HydratedBreadcrumb<'replay.mutations'>;
export type KeyboardEventFrame = HydratedBreadcrumb<'ui.keyDown'>;
export type BlurFrame = HydratedBreadcrumb<'ui.blur'>;
export type FocusFrame = HydratedBreadcrumb<'ui.focus'>;
export type SlowClickFrame = HydratedBreadcrumb<'ui.slowClickDetected'>;
export type MultiClickFrame = HydratedBreadcrumb<'ui.multiClick'>;

// This list should match each of the categories used in `HydratedBreadcrumb` above.
export const BreadcrumbCategories = [
  'console',
  'ui.click',
  'ui.input',
  'replay.mutations',
  'ui.keyDown',
  'ui.blur',
  'ui.focus',
  'ui.slowClickDetected',
  'ui.multiClick',
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

// This list should match each of the operations used in `HydratedSpan` above.
export const SpanOps = [
  'navigation.push',
  'largest-contentful-paint',
  'memory',
  'navigation.navigate',
  'navigation.reload',
  'navigation.back_forward',
  'paint',
  'resource.fetch',
  'resource.xhr',
  'resource.css',
  'resource.iframe',
  'resource.img',
  'resource.link',
  'resource.other',
  'resource.script',
];

/**
 * This is a result of a custom discover query
 */
export type RawReplayError = {
  ['error.type']: string[];
  // ['error.value']: string[]; // deprecated, use title instead. See organization_replay_events_meta.py
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
