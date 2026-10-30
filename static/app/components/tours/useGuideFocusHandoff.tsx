import type {HTMLAttributes, RefObject} from 'react';
import {useEffect, useRef} from 'react';

import {defined} from 'sentry/utils/defined';

/**
 * Whether focus is inside a guide, and whether a guide that had focus just
 * closed. A step change closes one guide and opens the next in the same commit,
 * so the next guide can take focus over. The handoff expires right after that
 * commit, so a guide that opens later never steals focus.
 */
let guideHasFocus = false;
let isHandingOffGuideFocus = false;

function releaseGuideFocus() {
  if (!guideHasFocus) {
    return;
  }
  guideHasFocus = false;
  isHandingOffGuideFocus = true;
  queueMicrotask(() => {
    isHandingOffGuideFocus = false;
  });
}

function takeGuideFocus() {
  const shouldTakeFocus = isHandingOffGuideFocus;
  isHandingOffGuideFocus = false;
  return shouldTakeFocus;
}

function handleGuideFocus() {
  guideHasFocus = true;
}

function handleGuideBlur(event: React.FocusEvent<HTMLElement>) {
  // A guide removed by a step change can still blur. Its focus is handed off.
  if (
    event.currentTarget.isConnected &&
    !event.currentTarget.contains(event.relatedTarget)
  ) {
    guideHasFocus = false;
  }
}

interface UseGuideFocusHandoffOptions {
  isOpen: boolean | undefined;
  /**
   * The guide's element, which takes focus when a guide that had focus closes.
   */
  overlayRef: RefObject<HTMLElement | null>;
  /**
   * Handles keys pressed while the guide has focus. Without it, the guide is not
   * focusable and takes part in no handoff.
   */
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

/**
 * When the tour moves to another step while a guide has focus, focuses the next
 * guide so the user can keep using the keyboard. Returns the props to spread on
 * the guide's element.
 */
export function useGuideFocusHandoff({
  isOpen,
  overlayRef,
  onKeyDown,
}: UseGuideFocusHandoffOptions): HTMLAttributes<HTMLElement> {
  const isFocusable = defined(onKeyDown);
  const shouldTakeFocusRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !isFocusable) {
      shouldTakeFocusRef.current = false;
      return;
    }
    if (takeGuideFocus()) {
      shouldTakeFocusRef.current = true;
    }
    // The guide's element can attach after it opens; this runs again then.
    if (shouldTakeFocusRef.current && overlayRef.current) {
      shouldTakeFocusRef.current = false;
      overlayRef.current.focus();
    }
    return releaseGuideFocus;
  }, [isOpen, isFocusable, overlayRef]);

  return isFocusable
    ? {tabIndex: -1, onKeyDown, onFocus: handleGuideFocus, onBlur: handleGuideBlur}
    : {};
}
