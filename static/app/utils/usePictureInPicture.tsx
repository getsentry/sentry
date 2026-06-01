import {useCallback, useEffect, useRef, useState} from 'react';

interface UsePictureInPictureOptions {
  /**
   * Called whenever the picture-in-picture window is closed — whether by the
   * user (native window controls), programmatically via `closePipWindow`, or by
   * the browser. NOT called when the owning component unmounts.
   */
  onClose?: () => void;
}

interface OpenPipWindowOptions {
  height?: number;
  /**
   * Opens at the browser's default placement instead of remembering where the
   * window was last positioned. Useful to avoid the window reappearing far from
   * where it was triggered.
   */
  preferInitialWindowPlacement?: boolean;
  width?: number;
}

interface UsePictureInPictureResult {
  /**
   * Closes the picture-in-picture window if one is open. Idempotent.
   */
  closePipWindow: () => void;
  /**
   * Whether the Document Picture-in-Picture API is available in this browser.
   */
  isSupported: boolean;
  /**
   * Opens a picture-in-picture window. Must be called from a user gesture (e.g.
   * a click handler) — the API requires transient activation.
   */
  openPipWindow: (options?: OpenPipWindowOptions) => Promise<void>;
  /**
   * The currently open picture-in-picture window, or null.
   */
  pipWindow: Window | null;
}

/**
 * Copies the document's static stylesheets into the picture-in-picture window so
 * its content renders with the same styles.
 *
 * Nodes are cloned directly rather than serialized rule-by-rule via `cssRules`:
 * cloning a `<link>` is a cheap reference to the (already cached) file, and
 * cloning a `<style>` copies its text as-is — both far faster than reading every
 * rule's `cssText`, and they avoid cross-origin access errors.
 *
 * Emotion's own style tags are skipped because `PictureInPicturePortal`
 * re-injects them via a PiP-scoped cache. Copying them here would duplicate a
 * large amount of CSS and is the main cause of slow pop-out (especially in dev
 * builds, where every styled component emits its own tag).
 */
function copyStyles(source: Document, target: Window) {
  const nodes = source.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    'link[rel="stylesheet"], style'
  );
  for (const node of nodes) {
    // Emotion styles are re-injected via the PiP-scoped emotion cache.
    if (node instanceof HTMLStyleElement && node.dataset.emotion) {
      continue;
    }
    target.document.head.appendChild(node.cloneNode(true));
  }
}

/**
 * Manages the lifecycle of a Document Picture-in-Picture window. Pair with
 * `PictureInPicturePortal` to render React content into the returned window.
 */
export function usePictureInPicture({
  onClose,
}: UsePictureInPictureOptions = {}): UsePictureInPictureResult {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const documentPictureInPicture =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window
      ? window.documentPictureInPicture
      : null;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Tracks the live window outside of React state so cleanup logic always sees
  // the current value without re-running effects.
  const pipWindowRef = useRef<Window | null>(null);

  const handleClose = useCallback(() => {
    pipWindowRef.current = null;
    setPipWindow(null);
    onCloseRef.current?.();
  }, []);

  const openPipWindow = useCallback(
    async ({width, height, preferInitialWindowPlacement}: OpenPipWindowOptions = {}) => {
      if (!documentPictureInPicture) {
        return;
      }
      // Only one PiP window may exist per document — reuse the existing one.
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        return;
      }

      const pip = await documentPictureInPicture.requestWindow({
        width,
        height,
        preferInitialWindowPlacement,
      });

      copyStyles(document, pip);
      // Mirror the theme class (e.g. `theme-dark`) onto the PiP body so global
      // body selectors apply. Kept in sync afterwards by `PictureInPicturePortal`.
      pip.document.body.className = document.body.className;

      pip.addEventListener('pagehide', handleClose, {once: true});

      pipWindowRef.current = pip;
      setPipWindow(pip);
    },
    [documentPictureInPicture, handleClose]
  );

  const closePipWindow = useCallback(() => {
    const pip = pipWindowRef.current;
    if (pip && !pip.closed) {
      // Fires `pagehide`, which drives `handleClose`.
      pip.close();
    }
  }, []);

  // On unmount, tear down the window WITHOUT invoking `onClose` (there is
  // nothing left to re-dock into).
  useEffect(() => {
    return () => {
      const pip = pipWindowRef.current;
      if (pip && !pip.closed) {
        pip.removeEventListener('pagehide', handleClose);
        pip.close();
      }
      pipWindowRef.current = null;
    };
  }, [handleClose]);

  const isSupported = !!documentPictureInPicture;
  return {pipWindow, isSupported, openPipWindow, closePipWindow};
}
