import {EventType} from '@sentry-internal/rrweb';
import type {eventWithTime as TEventWithTime} from '@sentry-internal/rrweb';
import type {
  ReplayBreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  ReplayOptionFrameEvent as TOptionFrameEvent,
  ReplayBreadcrumbFrame as TRawBreadcrumbFrame,
  ReplaySpanFrame as TRawSpanFrame,
  ReplaySpanFrameEvent as TSpanFrameEvent,
} from '@sentry/react';

export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';
export type {fullSnapshotEvent, incrementalSnapshotEvent} from '@sentry-internal/rrweb';

export {NodeType} from '@sentry-internal/rrweb-snapshot';
export {EventType, IncrementalSource} from '@sentry-internal/rrweb';

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
      category: 'ui.scroll';
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
export type RawSpanFrame =
  | Exclude<TRawSpanFrame, {op: ReplayWebVitalFrameOps}>
  | CompatibleReplayWebVitalFrame;
export type SpanFrameEvent = TSpanFrameEvent;

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

export type ClickFrame = HydratedBreadcrumb<'ui.click'>;
export type TapFrame = HydratedBreadcrumb<'ui.tap'>;
export type SwipeFrame = HydratedBreadcrumb<'ui.swipe'>;
export type ScrollFrame = HydratedBreadcrumb<'ui.scroll'>;
export type ConsoleFrame = HydratedBreadcrumb<'console'>;
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

// Spans
export type SpanFrame = Overwrite<TRawSpanFrame, HydratedStartEndDate>;
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

// OurLogs converted from log to frame for use with jump buttons etc.
export type OurLogsPseudoFrame = {
  category: 'ourlogs';
  offsetMs: number;
  timestampMs: number;
  data?: undefined;
};

/**
 * This is a result of a custom discover query
 */
export type RawReplayError = {
  ['error.type']: Array<string | undefined | null>;
  id: string;
  issue: string;
  ['issue.id']: number;
  level: string;
  ['project.name']: string;
  // Discover returns ms-precision timestamps in "YYYY-MM-DD HH:MM:SS.sss"
  // format (no "T", no timezone).
  timestamp_ms: string;
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
      level: string;
      projectSlug: string;
    };
    message: string;
  }
>;

export type ReplayFrame = BreadcrumbFrame | ErrorFrame | SpanFrame | OurLogsPseudoFrame;

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
