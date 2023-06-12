export {EventType} from '@sentry-internal/rrweb';
export {NodeType} from '@sentry-internal/rrweb-snapshot';
export type {eventWithTime, fullSnapshotEvent} from '@sentry-internal/rrweb';
export type {serializedNodeWithId} from '@sentry-internal/rrweb-snapshot';

export type {
  BreadcrumbFrame,
  BreadcrumbFrameEvent,
  OptionFrameEvent,
  SpanFrame,
  SpanFrameEvent,
} from './replayFrame';
