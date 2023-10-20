import type {
  BreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  OptionFrameEvent as TOptionFrameEvent,
  SpanFrameEvent as TSpanFrameEvent,
} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrameEvent<
  FrameEvent extends TBreadcrumbFrameEvent | TSpanFrameEvent | TOptionFrameEvent,
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
export function ReplayBreadcrumbFrameEvent(
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
 *     payload: ReplaySpanFrame({
 *      data: TestStubs.ReplaySpanFrameData.FOO({...})
 *     }),
 *   },
 * });
 * ```
 */
export function ReplaySpanFrameEvent(
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

export function ReplayOptionFrameEvent(
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

export function ReplayOptionFrame(
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
