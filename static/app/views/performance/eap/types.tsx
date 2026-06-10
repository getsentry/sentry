import type {GridColumnHeader} from 'sentry/components/tables/gridEditable/types';
import type {SpanResponse} from 'sentry/views/insights/types';

// TODO: When supported, also add span operation breakdown as a field
export type SegmentSpansRow = Pick<
  SpanResponse,
  | 'span_id'
  | 'user.id'
  | 'user.email'
  | 'user.username'
  | 'user.ip'
  | 'user.display'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id'
  | 'precise.start_ts'
  | 'precise.finish_ts'
>;

export type SegmentSpansColumn = GridColumnHeader<
  | 'span_id'
  | 'user.display'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
>;
