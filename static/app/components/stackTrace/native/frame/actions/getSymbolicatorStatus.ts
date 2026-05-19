import {combineStatus} from 'sentry/components/events/interfaces/debugMeta/utils';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';
import type {Frame} from 'sentry/types/event';

export type SymbolicatorIconStatus = 'success' | 'error' | 'warning' | undefined;

export function isDartAsyncSuspension(frame: Frame): boolean {
  return (
    frame.filename === '<asynchronous suspension>' ||
    frame.absPath === '<asynchronous suspension>'
  );
}

/**
 * Resolves the symbolicator status for a single frame. The image's combined
 * status (debug + unwind) wins over the frame's `symbolicatorStatus` when an
 * image is found — the image is the source of truth for the binary's debug
 * data. Returns the icon variant to display, or `undefined` for "no icon".
 */
export function getSymbolicatorStatus(
  frame: Frame,
  image: ImageWithCombinedStatus | null
): SymbolicatorIconStatus {
  if (isDartAsyncSuspension(frame)) {
    return 'success';
  }

  if (!image) {
    switch (frame.symbolicatorStatus) {
      case SymbolicatorStatus.SYMBOLICATED:
        return 'success';
      case SymbolicatorStatus.MISSING:
      case SymbolicatorStatus.MALFORMED:
        return 'error';
      case SymbolicatorStatus.UNKNOWN_IMAGE:
        return frame.instructionAddr === '0x0' ? 'success' : 'error';
      case SymbolicatorStatus.MISSING_SYMBOL:
      default:
        return 'warning';
    }
  }

  const combinedStatus = combineStatus(image.debug_status, image.unwind_status);
  switch (combinedStatus) {
    case 'unused':
      return undefined;
    case 'found':
      return 'success';
    default:
      return 'error';
  }
}

export function hasStatusIcon(status: SymbolicatorIconStatus): boolean {
  return status === 'error' || status === 'warning';
}
