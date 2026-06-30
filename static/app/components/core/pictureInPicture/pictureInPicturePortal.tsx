import {useEffect, useMemo} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider, useTheme} from '@emotion/react';

import {TooltipContext} from '@sentry/scraps/tooltip';

import {GlobalStyles} from 'sentry/styles/global';

interface PictureInPicturePortalProps {
  children: React.ReactNode;
  /**
   * The picture-in-picture window to render into. Obtain one via
   * `usePictureInPicture`.
   */
  pipWindow: Window;
}

/**
 * Renders children into a Document Picture-in-Picture window with the full
 * styling context wired up: a PiP-scoped emotion cache, the theme + global
 * styles, and a tooltip container override so overlays render in the PiP window
 * rather than the main one.
 */
export function PictureInPicturePortal({
  children,
  pipWindow,
}: PictureInPicturePortalProps) {
  const theme = useTheme();

  // Emotion injects dynamically-generated styles into the cache's container.
  // Bind a dedicated cache to the PiP document head so styles for the portaled
  // subtree land in the right window. Mirrors `ThemeAndStyleProvider`.
  const cache = useMemo(() => {
    const pipCache = createCache({
      key: 'app',
      container: pipWindow.document.head,
      stylisPlugins: [],
    });
    // Compat disables the :nth-child warning.
    pipCache.compat = true;
    return pipCache;
  }, [pipWindow]);

  // Make the PiP document fill the window so content with `height: 100%`
  // stretches the full height (the main app gets this from its base stylesheet,
  // which isn't guaranteed in the PiP document).
  useEffect(() => {
    const {documentElement, body} = pipWindow.document;
    documentElement.style.height = '100%';
    body.style.height = '100%';
    body.style.margin = '0';
  }, [pipWindow]);

  // Keep the PiP body's theme class in sync so global body selectors
  // (e.g. `body.theme-dark`) apply after a theme toggle.
  useEffect(() => {
    pipWindow.document.body.className = document.body.className;
  }, [pipWindow, theme]);

  return createPortal(
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <GlobalStyles theme={theme} />
        <TooltipContext value={{container: pipWindow.document.body}}>
          {children}
        </TooltipContext>
      </ThemeProvider>
    </CacheProvider>,
    pipWindow.document.body
  );
}
