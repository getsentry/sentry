import type {SpanFrame} from 'sentry/utils/replays/types';

export function getFrameType(frame: SpanFrame) {
  return frame.id ?? 'unknown';
}
export function getFramePath(frame: SpanFrame) {
  console.log(frame);
  return frame.element ?? 'unknown';
}
