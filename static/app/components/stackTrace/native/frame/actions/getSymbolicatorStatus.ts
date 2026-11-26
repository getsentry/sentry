import {combineStatus} from 'sentry/components/events/interfaces/debugMeta/utils';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import type {Image} from 'sentry/types/debugImage';
import type {Frame} from 'sentry/types/event';

export type SymbolicatorIconStatus = 'error' | 'warning' | null;

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
 * data. Returns the icon variant to display, or `null` for "no icon".
 */
export function getSymbolicatorStatus(
  frame: Frame,
  image: Image | null
): SymbolicatorIconStatus {
  if (isDartAsyncSuspension(frame)) {
    return null;
  }

  if (!image) {
    switch (frame.symbolicatorStatus) {
      case SymbolicatorStatus.SYMBOLICATED:
        return null;
      case SymbolicatorStatus.MISSING:
      case SymbolicatorStatus.MALFORMED:
        return 'error';
      case SymbolicatorStatus.UNKNOWN_IMAGE:
        return frame.instructionAddr === '0x0' ? null : 'error';
      case SymbolicatorStatus.MISSING_SYMBOL:
      default:
        return 'warning';
    }
  }

  const combinedStatus = combineStatus(image.debug_status, image.unwind_status);
  switch (combinedStatus) {
    case 'unused':
    case 'found':
      return null;
    default:
      return 'error';
  }
}
