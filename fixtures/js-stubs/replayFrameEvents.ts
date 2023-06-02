import type {
  BreadcrumbFrame as TBreadcrumbFrame,
  BreadcrumbFrameEvent as TBreadcrumbFrameEvent,
  OptionFrameEvent as TOptionFrameEvent,
  SpanFrame as TSpanFrame,
  SpanFrameEvent as TSpanFrameEvent,
} from 'sentry/views/replays/types';
import {EventType} from 'sentry/views/replays/types';

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

export function BreadcrumbFrame(
  fields: Omit<TBreadcrumbFrame, 'timestamp' | 'type'> & {timestamp: Date}
): TBreadcrumbFrame {
  return {
    type: fields.category,
    ...fields,
    timestamp: fields.timestamp.getTime() / 1000, // data inside events are in seconds
  };
}

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

export function SpanFrame(
  fields: Omit<TSpanFrame, 'startTimestamp' | 'endTimestamp'> & {
    endTimestamp: Date;
    startTimestamp: Date;
  }
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
