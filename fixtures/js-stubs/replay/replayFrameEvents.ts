import type {
  BreadcrumbFrameEvent,
  OptionFrameEvent,
  SpanFrameEvent,
} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type TestableFrameEvent<
  FrameEvent extends BreadcrumbFrameEvent | SpanFrameEvent | OptionFrameEvent,
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
 * ReplayBreadcrumbFrameEventFixture({
 *   timestamp,
 *   data: {
 *      payload: {...},
 *   },
 * });
 * ```
 */
export function ReplayBreadcrumbFrameEventFixture(
  fields: TestableFrameEvent<BreadcrumbFrameEvent>
): BreadcrumbFrameEvent {
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
 *     payload: ReplaySpanFrameEventFixture({
 *      data: {...}
 *     }),
 *   },
 * });
 * ```
 */
export function ReplaySpanFrameEventFixture(
  fields: TestableFrameEvent<SpanFrameEvent>
): SpanFrameEvent {
  return {
    type: EventType.Custom,
    timestamp: fields.timestamp.getTime(), // frame timestamps are in ms
    data: {
      tag: 'performanceSpan',
      payload: fields.data.payload,
    },
  };
}

export function ReplayOptionFrameEventFixture(
  fields: TestableFrameEvent<OptionFrameEvent>
): OptionFrameEvent {
  return {
    type: EventType.Custom,
    timestamp: fields.timestamp.getTime(), // frame timestamps are in ms
    data: {
      tag: 'options',
      payload: fields.data.payload,
    },
  };
}

export function ReplayOptionFrameFixture(
  fields: Partial<OptionFrameEvent['data']['payload']>
): OptionFrameEvent['data']['payload'] {
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
