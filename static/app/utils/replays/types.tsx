import type {
  eventWithTime as TEventWithTime,
  fullSnapshotEvent as TFullSnapshotEvent,
} from '@sentry-internal/rrweb';

import type {
  BreadcrumbFrame as TRawBreadcrumbFrame,
  BreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  OptionFrameEvent as TOptionFrameEvent,
  SpanFrame as TRawSpanFrame,
  SpanFrameEvent as TSpanFrameEvent,
} from './replayFrame';

export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';

export {NodeType} from '@sentry-internal/rrweb-snapshot';
export {EventType} from '@sentry-internal/rrweb';

export type RawBreadcrumbFrame = TRawBreadcrumbFrame;
export type BreadcrumbFrameEvent = TBreadcrumbFrameEvent;
export type RecordingFrame = TEventWithTime;
export type fullSnapshotEvent = TFullSnapshotEvent;
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

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type HydratedTimestamp = {
  offsetMS: number;
  timestamp: Date;
  timestampMS: number;
};
type HydratedBreadcrumb<Category extends string> = Overwrite<
  Extract<TRawBreadcrumbFrame, {category: Category}>,
  HydratedTimestamp
>;

type HydratedStartEndDate = {
  endTimestamp: Date;
  offsetMS: number;
  startTimestamp: Date;
  timestampMS: number; // Included to make sorting with `HydratedBreadcrumb` easier
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
    data: {
      eventId: string; // error['id']
      groupId: number; // error['issue.id']
      groupShortId: string; // error['issue']
      label: string; // error['error.type'].join('')
      projectSlug: string; // error['project.name']
    };
  }
>;
