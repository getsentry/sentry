import type {
  BreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  HistoryData as THistoryData,
  LargestContentfulPaintData as TLargestContentfulPaintData,
  MemoryData as TMemoryData,
  NavigationData as TNavigationData,
  NetworkRequestData as TNetworkRequestData,
  OptionFrameEvent as TOptionFrameEvent,
  PaintData as TPaintData,
  ResourceData as TResourceData,
  SpanFrame as TSpanFrame,
  SpanFrameEvent as TSpanFrameEvent,
} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrameEvent<
  FrameEvent extends TBreadcrumbFrameEvent | TSpanFrameEvent | TOptionFrameEvent
> = Overwrite<
  Omit<FrameEvent, 'type'>,
  {
    data: Omit<FrameEvent['data'], 'tag'>;
    timestamp: Date;
  }
>;

/**
 * `BreadcrumbFrameData` has factories to help construct the correct payloads.
 *
 * ```
 * BreadcrumbFrameEvent({
 *   timestamp,
 *   data: {
 *      payload: TestStubs.BreadcrumbFrameData.FOO({}),
 *   },
 * });
 * ```
 */
export function BreadcrumbFrameEvent(
  fields: TestableFrameEvent<TBreadcrumbFrameEvent>
): TBreadcrumbFrameEvent {
  return {
    type: EventType.Custom,
    timestamp: fields.timestamp.getTime(), // frame timestamps are in ms
    data: {
      tag: 'breadcrumb',
      payload: fields.data.payload,
      metric: fields.data.metric,
    },
  };
}

/**
 * `SpanFrame()` is a factories to help consturt valid payloads given an operation name.
 * `ReplaySpanFrameData.*` contains more factories to build the required inner dataset.
 *
 * ```
 * SpanFrameEvent({
 *   timestamp,
 *   data: {
 *     payload: TestStubs.Replay.SpanFrame({
 *      data: TestStubs.ReplaySpanFrameData.FOO({...})
 *     }),
 *   },
 * });
 * ```
 */
export function SpanFrameEvent(
  fields: TestableFrameEvent<TSpanFrameEvent>
): TSpanFrameEvent {
  return {
    type: EventType.Custom,
    timestamp: fields.timestamp.getTime(), // frame timestamps are in ms
    data: {
      tag: 'performanceSpan',
      payload: fields.data.payload,
    },
  };
}

type SpanPayloadPerOp =
  | {data: TPaintData; op: 'paint'}
  | {
      data: TNavigationData;
      op: 'navigation.navigate' | 'navigation.reload';
    }
  | {
      data: TResourceData;
      op:
        | 'resource.css'
        | 'resource.iframe'
        | 'resource.img'
        | 'resource.link'
        | 'resource.other'
        | 'resource.script'
        | 'resource.xhr';
    }
  | {data: TLargestContentfulPaintData; op: 'largest-contentful-paint'}
  | {data: TMemoryData; op: 'memory'}
  | {data: TNetworkRequestData; op: 'resource.fetch'}
  | {data: THistoryData; op: 'navigation.push'};

export function SpanFrame(
  fields: Overwrite<
    Omit<TSpanFrame, 'startTimestamp' | 'endTimestamp'> & {
      endTimestamp: Date;
      startTimestamp: Date;
    },
    SpanPayloadPerOp
  >
): TSpanFrame {
  return {
    ...fields,
    data: fields.data,
    description: fields.description,
    op: fields.op,
    endTimestamp: fields.endTimestamp.getTime() / 1000, // data inside events are in seconds
    startTimestamp: fields.startTimestamp.getTime() / 1000, // data inside events are in seconds
  };
}

export function OptionFrameEvent(
  fields: TestableFrameEvent<TOptionFrameEvent>
): TOptionFrameEvent {
  return {
    type: EventType.Custom,
    timestamp: fields.timestamp.getTime(), // frame timestamps are in ms
    data: {
      tag: 'options',
      payload: fields.data.payload,
    },
  };
}

export function OptionFrame(
  fields: Partial<TOptionFrameEvent['data']['payload']>
): TOptionFrameEvent['data']['payload'] {
  return {
    blockAllMedia: false,
    errorSampleRate: 0,
    maskAllInputs: false,
    maskAllText: false,
    networkCaptureBodies: false,
    networkDetailHasUrls: false,
    networkRequestHasHeaders: false,
    networkResponseHasHeaders: false,
    sessionSampleRate: 0,
    useCompression: false,
    useCompressionOption: false,
    ...fields,
  };
}
