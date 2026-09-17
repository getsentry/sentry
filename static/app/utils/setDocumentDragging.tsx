import type {CSS} from '@sentry/scraps/cssTypes';

/**
 * Locks the document for the duration of a drag, or releases it when passed `null`.
 *
 * A drag travels outside the element that started it, so suppressing hover and text
 * selection — and holding the resize cursor — has to happen at the document level.
 * The cursor goes on the root element because pointer events are disabled on `body`.
 */
export function setDocumentDragging(cursor: CSS['cursor'] | null) {
  document.body.style.pointerEvents = cursor ? 'none' : '';
  document.body.style.userSelect = cursor ? 'none' : '';
  document.documentElement.style.cursor = cursor ?? '';
}
