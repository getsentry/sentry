import type {SpanFrame} from 'sentry/utils/replays/types';

export function getFrameType(frame: SpanFrame) {
  return frame.id ?? 'unknown';
}
export function getFramePath(frame: SpanFrame) {
  return frame.element ?? 'unknown';
}
