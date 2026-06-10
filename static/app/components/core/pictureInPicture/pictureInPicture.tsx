import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface RequestPipWindowOptions {
  height?: number;
  /**
   * Opens at the browser's default placement instead of remembering where the
   * window was last positioned. Useful to avoid the window reappearing far from
   * where it was triggered.
   */
  preferInitialWindowPlacement?: boolean;
  width?: number;
}

interface PictureInPictureContextValue {
  /**
   * Closes the picture-in-picture window if one is open. Idempotent.
   */
  closePipWindow: () => void;
  /**
   * Whether the Document Picture-in-Picture API is available in this browser.
   */
  isSupported: boolean;
  /**
   * The currently open picture-in-picture window, or null. Watch this value to
   * react to the window being closed (by the user or programmatically).
   */
  pipWindow: Window | null;
  /**
   * Opens a picture-in-picture window. Must be called from a user gesture (e.g.
   * a click handler) — the API requires transient activation.
   */
  requestPipWindow: (options?: RequestPipWindowOptions) => Promise<void>;
}

const PictureInPictureContext = createContext<PictureInPictureContextValue | null>(null);

/**
 * Copies the document's static stylesheets into the picture-in-picture window so
 * its content renders with the same styles.
 *
 * Styles must be applied *synchronously* — content that measures itself on mount
 * (e.g. autosizing textareas reading `getComputedStyle`) would otherwise compute
 * the wrong size before async styles load. So linked stylesheets are inlined
 * rule-by-rule rather than cloned (a cloned `<link>` fetches asynchronously);
 * `<style>` tags are cloned since their text is already present.
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

    // Inline linked stylesheets so they apply immediately. Cross-origin sheets
    // throw on `cssRules` access — fall back to cloning the <link> for those.
    if (node instanceof HTMLLinkElement) {
      try {
        const cssText = Array.from(node.sheet?.cssRules ?? [])
          .map(rule => rule.cssText)
          .join('');
        const style = target.document.createElement('style');
        style.textContent = cssText;
        target.document.head.appendChild(style);
        continue;
      } catch {
        // Cross-origin stylesheet — clone the <link> (loads asynchronously).
      }
    }

    target.document.head.appendChild(node.cloneNode(true));
  }
}

/**
 * Owns the single Document Picture-in-Picture window for the tab (the API allows
 * only one PiP window per browser tab). Provides it through context so any
 * component can open, close, or render into it via `usePictureInPicture`.
 *
 * Pair with `PictureInPicturePortal` to render React content into the window.
 */
export function PictureInPictureProvider({children}: {children: ReactNode}) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const documentPictureInPicture =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window
      ? window.documentPictureInPicture
      : null;

  // Tracks the live window outside of React state so cleanup logic always sees
  // the current value without re-running effects.
  const pipWindowRef = useRef<Window | null>(null);

  const handleClose = useCallback(() => {
    pipWindowRef.current = null;
    setPipWindow(null);
  }, []);

  const requestPipWindow = useCallback(
    async ({
      width,
      height,
      preferInitialWindowPlacement,
    }: RequestPipWindowOptions = {}) => {
      if (!documentPictureInPicture) {
        return;
      }
      // Only one PiP window may exist per tab — reuse the existing one.
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

  // On unmount, tear down the window.
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

  const value = useMemo<PictureInPictureContextValue>(
    () => ({
      pipWindow,
      isSupported: !!documentPictureInPicture,
      requestPipWindow,
      closePipWindow,
    }),
    [pipWindow, documentPictureInPicture, requestPipWindow, closePipWindow]
  );

  return (
    <PictureInPictureContext.Provider value={value}>
      {children}
    </PictureInPictureContext.Provider>
  );
}

export function usePictureInPicture(): PictureInPictureContextValue {
  const context = useContext(PictureInPictureContext);

  if (!context) {
    throw new Error('usePictureInPicture must be used within a PictureInPictureProvider');
  }

  return context;
}
