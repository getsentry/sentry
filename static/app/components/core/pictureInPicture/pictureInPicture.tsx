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

const NON_RELATIVE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Rewrites relative `url(...)` references in serialized CSS to absolute URLs
 * against `baseHref`.
 *
 * Chromium serializes `url()` in `cssText` as authored (relative), so once the
 * text is inlined into the PiP document — whose base URL is `about:blank` —
 * relative references (e.g. `@font-face` files) would no longer resolve. We
 * resolve them against the source sheet's own URL instead.
 */
function resolveCssUrls(cssText: string, baseHref: string): string {
  return cssText.replace(
    /url\((['"]?)([^'")]*)\1\)/g,
    (match: string, quote: string, url: string) => {
      if (!url || NON_RELATIVE_URL.test(url)) {
        return match;
      }
      try {
        return `url(${quote}${new URL(url, baseHref).href}${quote})`;
      } catch {
        return match;
      }
    }
  );
}

/**
 * Copies the document's stylesheets into the picture-in-picture window so its
 * content renders with the same styles.
 *
 * Each sheet's rules are read from the CSSOM (`sheet.cssRules`) and inlined into
 * a `<style>` tag so they apply *synchronously* — content that measures itself on
 * mount (e.g. autosizing textareas reading `getComputedStyle`) would otherwise
 * compute the wrong size before styles load. Reading the CSSOM also captures
 * rules inserted at runtime via `insertRule` (which leave the source `<style>`
 * empty), which cloning the node would miss. Relative `url()`s are resolved
 * against the source sheet so assets (e.g. fonts) still load in the PiP document.
 * Cross-origin sheets throw on `cssRules` access — those fall back to cloning the
 * owning node (loads async).
 *
 * Emotion's own style tags are skipped because `PictureInPicturePortal`
 * re-injects them via a PiP-scoped cache. Copying them here would duplicate a
 * large amount of CSS and is the main cause of slow pop-out (especially in dev
 * builds, where every styled component emits its own tag).
 */
function copyStyles(source: Document, target: Window) {
  for (const sheet of Array.from(source.styleSheets)) {
    const owner = sheet.ownerNode;

    // Emotion styles are re-injected via the PiP-scoped emotion cache.
    if (owner instanceof HTMLStyleElement && owner.dataset.emotion) {
      continue;
    }

    try {
      const cssText = Array.from(sheet.cssRules)
        .map(rule => rule.cssText)
        .join('');
      const style = target.document.createElement('style');
      style.textContent = resolveCssUrls(cssText, sheet.href ?? source.baseURI);
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin stylesheet — clone the owning node (loads asynchronously).
      if (owner) {
        target.document.head.appendChild(owner.cloneNode(true));
      }
    }
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

      // If any setup fails, close the window so we don't leak an orphaned,
      // untracked PiP window with no React portal rendered into it.
      try {
        copyStyles(document, pip);
        // Mirror the theme class (e.g. `theme-dark`) onto the PiP body so global
        // body selectors apply. Kept in sync after by `PictureInPicturePortal`.
        pip.document.body.className = document.body.className;

        pip.addEventListener('pagehide', handleClose, {once: true});

        pipWindowRef.current = pip;
        setPipWindow(pip);
      } catch (error) {
        pip.close();
        throw error;
      }
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
