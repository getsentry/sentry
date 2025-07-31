import {useCallback, useLayoutEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';

import useMedia from 'sentry/utils/useMedia';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

const MIN_WIDTH_PERCENT = 20;
const MAX_WIDTH_PERCENT = 85;
const DEFAULT_WIDTH_PERCENT = 50;

function getDrawerWidthKey(drawerKey: string) {
  return `drawer-width:${drawerKey}`;
}

interface UseDrawerResizingOptions {
  drawerKey?: string;
  drawerWidth?: string;
  enabled?: boolean;
}

interface UseDrawerResizingResult {
  enabled: boolean;
  handleResizeStart: (e: React.MouseEvent) => void;
  panelRef: React.RefObject<HTMLDivElement>;
  persistedWidthPercent: number;
  resizeHandleRef: React.RefObject<HTMLDivElement>;
}

export function useDrawerResizing({
  drawerKey,
  drawerWidth,
  enabled = true,
}: UseDrawerResizingOptions): UseDrawerResizingResult {
  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const resizeHandleRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const panelRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const rafIdRef = useRef<number | null>(null);
  const initialMousePositionRef = useRef<number | null>(null);

  // Calculate initial width from props or use default
  const calculateInitialWidth = (savedWidth?: number) => {
    // If we have a saved width, use it but ensure it's within bounds
    if (savedWidth !== undefined) {
      return Math.min(Math.max(savedWidth, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT);
    }

    if (drawerWidth) {
      // If width is already in percentage, parse and clamp it
      if (drawerWidth.endsWith('%')) {
        const parsedPercent = parseFloat(drawerWidth);
        return Math.min(Math.max(parsedPercent, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT);
      }
      // If width is in pixels, convert to percentage and clamp
      const viewportWidth = window.innerWidth;
      const parsedPixels = parseFloat(drawerWidth);
      const percentValue = (parsedPixels / viewportWidth) * 100;
      return Math.min(Math.max(percentValue, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT);
    }

    return DEFAULT_WIDTH_PERCENT;
  };

  // Store persisted width in localStorage, but don't use it for rendering state
  const [persistedWidthPercent, setPersistedWidthPercent] =
    useSyncedLocalStorageState<number>(
      drawerKey ? getDrawerWidthKey(drawerKey) : 'drawer-width:default',
      (value?: unknown) => {
        const savedWidth = typeof value === 'number' ? value : undefined;
        return calculateInitialWidth(savedWidth);
      }
    );

  useLayoutEffect(() => {
    if (isSmallScreen) {
      panelRef.current?.style.setProperty('--drawer-width', '100%');
      panelRef.current?.style.setProperty('--drawer-min-width', '100%');
      panelRef.current?.style.setProperty('--drawer-max-width', '100%');
    } else if (!enabled && drawerWidth) {
      panelRef.current?.style.setProperty('--drawer-width', `${drawerWidth}`);
      panelRef.current?.style.setProperty('--drawer-min-width', `${drawerWidth}`);
      panelRef.current?.style.setProperty('--drawer-max-width', `${drawerWidth}`);
    } else {
      panelRef.current?.style.setProperty('--drawer-width', `${persistedWidthPercent}%`);
      panelRef.current?.style.setProperty('--drawer-min-width', `${MIN_WIDTH_PERCENT}%`);
      panelRef.current?.style.setProperty('--drawer-max-width', `${MAX_WIDTH_PERCENT}%`);
    }
  }, [persistedWidthPercent, isSmallScreen, drawerWidth, enabled]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      // Don't allow resizing on small screens
      if (isSmallScreen || !enabled) {
        return;
      }

      e.preventDefault();

      const handle = resizeHandleRef.current;
      const panel = panelRef.current;
      if (!handle || !panel) {
        return;
      }

      // Mark as resizing
      handle.setAttribute('data-resizing', '');
      panel.setAttribute('data-resizing', '');
      initialMousePositionRef.current = e.clientX;

      const viewportWidth = typeof window === 'undefined' ? 1000 : window.innerWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();

        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = window.requestAnimationFrame(() => {
          if (!panel || !handle || initialMousePositionRef.current === null) {
            return;
          }

          const newWidthPercent =
            ((viewportWidth - moveEvent.clientX) / viewportWidth) * 100;

          panel.style.setProperty('--drawer-width', `${newWidthPercent}%`);

          // Update handle attributes for cursor styles
          handle.setAttribute(
            'data-at-min-width',
            (newWidthPercent <= MIN_WIDTH_PERCENT).toString()
          );
          handle.setAttribute(
            'data-at-max-width',
            (Math.abs(newWidthPercent - MAX_WIDTH_PERCENT) < 1).toString()
          );
        });
      };

      const handleMouseUp = () => {
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        if (handle) {
          handle.removeAttribute('data-resizing');
        }

        if (panel) {
          panel.removeAttribute('data-resizing');
          // Get the computed width considering min/max constraints and save to localStorage
          const computedStyle = window.getComputedStyle(panel);
          const widthValue = (parseFloat(computedStyle.width) / viewportWidth) * 100;
          setPersistedWidthPercent(widthValue);
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isSmallScreen, enabled, setPersistedWidthPercent]
  );

  useLayoutEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    panelRef,
    resizeHandleRef,
    handleResizeStart,
    persistedWidthPercent,
    enabled: !isSmallScreen && !!drawerKey && enabled,
  };
}

export {MIN_WIDTH_PERCENT, MAX_WIDTH_PERCENT, DEFAULT_WIDTH_PERCENT};
