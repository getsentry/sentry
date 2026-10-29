import {useLayoutEffect, useRef, useState} from 'react';

export const MIN_WIDTH_PERCENT = 20;
export const MAX_WIDTH_PERCENT = 85;
export const DEFAULT_WIDTH_PERCENT = 50;

export function clampDrawerWidth(width: number) {
  return Math.min(Math.max(width, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT);
}

interface UseDrawerResizingOptions {
  isSmallScreen: boolean;
  widthPercent: number;
  drawerMaxWidth?: string;
  drawerWidth?: string;
  enabled?: boolean;
  onWidthChange?: (widthPercent: number) => void;
}

export function useDrawerResizing({
  widthPercent,
  isSmallScreen,
  drawerWidth,
  drawerMaxWidth,
  onWidthChange,
  enabled = true,
}: UseDrawerResizingOptions) {
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const dragWidthRef = useRef<number | null>(null);
  const [resizeState, setResizeState] = useState({
    input: widthPercent,
    width: clampDrawerWidth(widthPercent),
  });
  const width = Object.is(resizeState.input, widthPercent)
    ? resizeState.width
    : clampDrawerWidth(widthPercent);
  if (!Object.is(resizeState.input, widthPercent)) {
    setResizeState({input: widthPercent, width});
  }

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const nextWidth = width;
    if (isSmallScreen) {
      panel?.style.setProperty('--drawer-width', '100%');
      panel?.style.setProperty('--drawer-min-width', '100%');
      panel?.style.setProperty('--drawer-max-width', '100%');
    } else if (!enabled && drawerWidth) {
      panel?.style.setProperty('--drawer-width', drawerWidth);
      panel?.style.setProperty('--drawer-min-width', drawerWidth);
      panel?.style.setProperty('--drawer-max-width', drawerWidth);
    } else {
      panel?.style.setProperty('--drawer-width', `${nextWidth}%`);
      panel?.style.setProperty('--drawer-min-width', `${MIN_WIDTH_PERCENT}%`);
      panel?.style.setProperty(
        '--drawer-max-width',
        drawerMaxWidth
          ? `min(${MAX_WIDTH_PERCENT}%, ${drawerMaxWidth})`
          : `${MAX_WIDTH_PERCENT}%`
      );
    }
  }, [width, isSmallScreen, drawerWidth, drawerMaxWidth, enabled]);

  const applyWidth = () => {
    const panel = panelRef.current;
    if (!panel || dragWidthRef.current === null) {
      return;
    }
    panel.style.setProperty('--drawer-width', `${dragWidthRef.current}%`);
    // Use the rendered width so custom CSS bounds also apply to the next step.
    const computedWidth = parseFloat(window.getComputedStyle(panel).width);
    if (Number.isFinite(computedWidth)) {
      dragWidthRef.current = (computedWidth / window.innerWidth) * 100;
    }
  };

  const handleMoveStart = () => {
    if (isSmallScreen || !enabled) {
      return;
    }
    dragWidthRef.current = width;
    panelRef.current?.setAttribute('data-resizing', '');
    applyWidth();
  };

  const handleMove = (delta: number) => {
    if (dragWidthRef.current === null) {
      return;
    }
    dragWidthRef.current = clampDrawerWidth(
      dragWidthRef.current - (delta / window.innerWidth) * 100
    );
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      applyWidth();
    });
  };

  const handleMoveEnd = () => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Flush the last move even if pointerup precedes the animation frame.
    applyWidth();
    panelRef.current?.removeAttribute('data-resizing');
    if (dragWidthRef.current !== null) {
      const nextWidth = clampDrawerWidth(dragWidthRef.current);
      dragWidthRef.current = null;
      setResizeState({input: widthPercent, width: nextWidth});
      onWidthChange?.(nextWidth);
    }
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      panel?.removeAttribute('data-resizing');
    };
  }, []);

  return {panelRef, resizeHandleRef, width, handleMove, handleMoveStart, handleMoveEnd};
}
